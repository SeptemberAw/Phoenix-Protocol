from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from economy.services import log_transaction

# Anti-spam burst config: allow BURST_LIMIT toggles within BURST_WINDOW seconds,
# then enforce SPAM_COOLDOWN seconds before next action.
BURST_LIMIT = 6
BURST_WINDOW = 30   # seconds — window resets after this
SPAM_COOLDOWN = 10  # seconds — cooldown when burst limit exceeded


def get_core_bonus(profile) -> Decimal:
    from game.models import UserUpgrade
    try:
        core_upgrade = UserUpgrade.objects.get(user=profile, config__config_id="u2")
        return Decimal(str(core_upgrade.level)) * Decimal("0.005")
    except UserUpgrade.DoesNotExist:
        return Decimal("0")


def get_league_multiplier(profile) -> Decimal:
    """Get league multiplier based on Redis rank. O(log N) lookup."""
    from django.core.cache import cache
    try:
        redis_client = cache.client.get_client()
        from season.models import Season
        active_season = Season.objects.filter(is_active=True).first()
        key = f"leaderboard:season:{active_season.id}" if active_season else "leaderboard:global"
        rank = redis_client.zrevrank(key, str(profile.telegram_id))
        if rank is None:
            return Decimal("1")
        rank += 1  # 0-indexed to 1-indexed
        if rank <= 10:   return Decimal("3.0")
        if rank <= 100:  return Decimal("2.0")
        if rank <= 500:  return Decimal("1.5")
        if rank <= 1000: return Decimal("1.25")
        if rank <= 5000: return Decimal("1.1")
        return Decimal("1")
    except Exception:
        return Decimal("1")


def get_mining_power(profile) -> Decimal:
    core_bonus = get_core_bonus(profile)
    power = (Decimal("0.005") + core_bonus) * (Decimal("1.5") ** (profile.generation - 1))
    net_mult = Decimal(str(profile.network_multiplier))
    league_mult = get_league_multiplier(profile)
    return power * net_mult * league_mult


def calculate_max_energy(profile) -> int:
    from game.models import UserUpgrade
    base = settings.MAX_ENERGY_DEFAULT
    try:
        energy_upgrade = UserUpgrade.objects.get(user=profile, config__config_id="u1")
        return base + int(energy_upgrade.level * 500)
    except UserUpgrade.DoesNotExist:
        return base


def get_regen_rate(profile) -> int:
    """Energy regen per second: base + u3 Rapid Cooling bonus."""
    from game.models import UserUpgrade
    base = settings.ENERGY_REGEN_PER_SEC
    try:
        cooling = UserUpgrade.objects.get(user=profile, config__config_id="u3")
        return base + int(cooling.level * 2)  # benefit_per_level = 2
    except UserUpgrade.DoesNotExist:
        return base


def regenerate_energy(profile) -> None:
    now = timezone.now()
    elapsed = (now - profile.last_energy_update).total_seconds()
    if elapsed <= 0:
        return

    max_e = calculate_max_energy(profile)
    profile.max_energy = max_e

    if profile.energy < max_e and not profile.is_mining:
        regen_per_sec = get_regen_rate(profile)
        regen = int(elapsed * regen_per_sec)
        profile.energy = min(max_e, profile.energy + regen)

    profile.last_energy_update = now


def _is_auto_mining_active(profile) -> bool:
    """Check if paid auto-miner is currently active."""
    return bool(profile.auto_mining_until and profile.auto_mining_until > timezone.now())


def _is_turbo_active(profile) -> bool:
    """Check if paid turbo x2 boost is currently active."""
    return bool(profile.turbo_boost_until and profile.turbo_boost_until > timezone.now())


def harvest_mining(profile) -> Decimal:
    """Harvest mining rewards. Two modes:
    - Normal: uses energy, stops when energy depleted.
    - Auto-mining (paid): no energy cost, runs until auto_mining_until expires.
    Turbo x2 applies in both modes."""
    regenerate_energy(profile)

    is_auto = _is_auto_mining_active(profile)

    # If auto-mining just expired, stop mining
    if not is_auto and profile.auto_mining_until and profile.auto_mining_until <= timezone.now():
        profile.auto_mining_until = None
        profile.is_mining = False
        profile.mining_started_at = None
        profile.save()
        return Decimal("0")

    if not profile.is_mining or profile.mining_started_at is None:
        profile.save()
        return Decimal("0")

    now = timezone.now()
    elapsed = (now - profile.mining_started_at).total_seconds()
    if elapsed <= 0:
        profile.save()
        return Decimal("0")

    is_turbo = _is_turbo_active(profile)
    power = get_mining_power(profile)
    if is_turbo:
        power = power * Decimal("2")

    raw_mined = power * Decimal(str(elapsed))
    energy_needed = 0

    if not is_auto:
        # Normal mining: energy cost
        base_power = Decimal("0.005") + get_core_bonus(profile)
        energy_cost_ratio = Decimal(str(settings.ENERGY_COST_RATIO))
        energy_needed = int(base_power * Decimal(str(elapsed)) * energy_cost_ratio)

        if energy_needed <= 0:
            profile.save()
            return Decimal("0")

        if energy_needed > profile.energy:
            actual_energy = profile.energy
            raw_mined = Decimal(str(actual_energy)) / energy_cost_ratio
            if is_turbo:
                raw_mined = raw_mined * Decimal("2")
            energy_needed = actual_energy

        profile.energy -= energy_needed

    # Credit balance
    if raw_mined > 0:
        profile.balance += raw_mined
        profile.week_earned += raw_mined
        profile.month_earned += raw_mined
        profile.season_balance += raw_mined
        profile.networth += raw_mined
    profile.lifetime_balance += raw_mined

    # Stop check (only for normal mining when energy runs out)
    if not is_auto and profile.energy <= 0:
        profile.energy = 0
        profile.is_mining = False
        profile.mining_started_at = None
        profile.energy_depleted_at = now
    else:
        profile.mining_started_at = now

    profile.save()

    if raw_mined > 0:
        detail = f"Mined for {elapsed:.1f}s, power={power}"
        if energy_needed > 0:
            detail += f", energy_spent={energy_needed}"
        if is_auto:
            detail += ", auto_mining"
        if is_turbo:
            detail += ", turbo_x2"
        log_transaction(profile=profile, tx_type="mining", amount=raw_mined, detail=detail)
        update_leaderboard(profile)
        _credit_referral_bonus(profile, raw_mined)
        _maybe_create_block(profile, raw_mined)

    return raw_mined


def _credit_referral_bonus(profile, mined_amount: Decimal) -> None:
    """Credit referrer REFERRAL_BONUS_PERCENT of referral's mining income.
    Only applies when the referred user is verified (paid)."""
    if not profile.referred_by_id:
        return
    if not profile.is_verified:
        return
    bonus_pct = Decimal(str(settings.REFERRAL_BONUS_PERCENT))
    bonus = mined_amount * bonus_pct
    if bonus <= 0:
        return
    try:
        from accounts.models import UserProfile
        UserProfile.objects.filter(pk=profile.referred_by_id).update(
            balance=models.F("balance") + bonus,
            week_earned=models.F("week_earned") + bonus,
            month_earned=models.F("month_earned") + bonus,
            season_balance=models.F("season_balance") + bonus,
            networth=models.F("networth") + bonus,
            lifetime_balance=models.F("lifetime_balance") + bonus,  # legacy
        )
        # Log transaction for the referrer
        referrer = UserProfile.objects.get(pk=profile.referred_by_id)
        log_transaction(
            profile=referrer,
            tx_type="referral_bonus",
            amount=bonus,
            detail=f"10% bonus from {profile.telegram_username or profile.telegram_id} mining",
        )
        update_leaderboard(referrer)
    except Exception:
        pass  # Non-critical — don't break mining if referral bonus fails


def _maybe_create_block(profile, mined_amount: Decimal) -> None:
    """Probabilistically create a block feed entry on harvest.
    ~40% chance per harvest. Uses random player names from DB."""
    import random
    if random.random() > 0.40:
        return
    try:
        from game.models import BlockFeed
        from accounts.models import UserProfile
        last = BlockFeed.objects.order_by("-block_number").values_list("block_number", flat=True).first()
        next_num = (last or 9000) + 1
        hex_hash = format(random.randint(0, 0xFFFFFF), '06X')
        # Cap reward to realistic range (0.5 - 99.9)
        reward = round(random.uniform(0.5, 99.9), 2)
        # Pick a random player name from the database
        random_players = list(
            UserProfile.objects.filter(is_banned=False)
            .exclude(telegram_username="")
            .values_list("telegram_username", flat=True)
            .order_by("?")[:1]
        )
        finder_name = random_players[0] if random_players else f"Node_{random.randint(100, 999)}"
        BlockFeed.objects.create(
            block_number=next_num,
            block_hash=f"0x{hex_hash}",
            reward=Decimal(str(reward)),
            finder=finder_name,
            difficulty=f"{random.randint(10, 90)}T",
            participants=random.randint(2, 9),
        )
        # Trim old blocks — keep last 50
        old_ids = BlockFeed.objects.order_by("-created_at").values_list("id", flat=True)[50:]
        if old_ids:
            BlockFeed.objects.filter(id__in=list(old_ids)).delete()
    except Exception:
        pass  # Non-critical


def check_mining_cooldown(profile) -> int:
    """Burst-based anti-spam: allow BURST_LIMIT fast toggles, then cooldown.
    Returns seconds remaining on cooldown, or 0 if ready."""
    from django.core.cache import cache

    uid = profile.pk
    cooldown_key = f"mining_spam_cd:{uid}"

    # Check if user is currently in spam cooldown
    cd_remaining = cache.get(cooldown_key)
    if cd_remaining is not None:
        import time
        expire_at = cd_remaining  # stored as timestamp
        remaining = expire_at - time.time()
        if remaining > 0:
            return int(remaining + 0.5)
        cache.delete(cooldown_key)

    return 0


def _record_mining_toggle(profile):
    """Record a mining toggle. If burst limit exceeded, set cooldown."""
    from django.core.cache import cache
    import time

    uid = profile.pk
    burst_key = f"mining_burst:{uid}"

    # Get current burst data: [count, window_start_timestamp]
    burst = cache.get(burst_key)
    now = time.time()

    if burst is None:
        # First toggle — start new window
        cache.set(burst_key, [1, now], timeout=BURST_WINDOW)
        return

    count, window_start = burst

    # Window expired — reset
    if now - window_start > BURST_WINDOW:
        cache.set(burst_key, [1, now], timeout=BURST_WINDOW)
        return

    count += 1

    if count > BURST_LIMIT:
        # Spam detected — apply cooldown
        cooldown_key = f"mining_spam_cd:{uid}"
        cache.set(cooldown_key, now + SPAM_COOLDOWN, timeout=SPAM_COOLDOWN + 1)
        # Reset burst counter for after cooldown
        cache.delete(burst_key)
    else:
        # Update count within same window
        ttl = max(1, int(BURST_WINDOW - (now - window_start)))
        cache.set(burst_key, [count, window_start], timeout=ttl)


def start_mining(profile) -> dict:
    """Returns dict with 'started', 'cooldown_remaining', 'energy'.
    Blocked while auto-mining is active."""
    regenerate_energy(profile)

    # Auto-mining is running — can't start regular mining
    if _is_auto_mining_active(profile):
        profile.save()
        return {"started": False, "cooldown_remaining": 0, "energy": profile.energy,
                "auto_mining": True}

    cooldown = check_mining_cooldown(profile)
    if cooldown > 0:
        profile.save()
        return {"started": False, "cooldown_remaining": cooldown, "energy": profile.energy}

    if profile.is_mining:
        profile.save()
        return {"started": False, "cooldown_remaining": 0, "energy": profile.energy}

    if profile.energy <= 0:
        profile.save()
        return {"started": False, "cooldown_remaining": 0, "energy": profile.energy}

    profile.is_mining = True
    profile.mining_started_at = timezone.now()
    profile.last_mining_toggle = timezone.now()
    profile.save()
    _record_mining_toggle(profile)
    return {"started": True, "cooldown_remaining": 0, "energy": profile.energy}


def stop_mining(profile) -> dict:
    """Stop mining. Blocked while auto-miner is active."""
    if not profile.is_mining:
        regenerate_energy(profile)
        profile.save()
        return {
            "mined": Decimal("0"), "balance": profile.balance,
            "energy": profile.energy, "is_mining": False, "cooldown_remaining": 0,
        }

    # Auto-mining can't be stopped
    if _is_auto_mining_active(profile):
        mined = harvest_mining(profile)
        profile.refresh_from_db()
        remaining = int((profile.auto_mining_until - timezone.now()).total_seconds()) if profile.auto_mining_until else 0
        return {
            "mined": mined, "balance": profile.balance,
            "energy": profile.energy, "is_mining": True, "cooldown_remaining": 0,
            "auto_mining": True, "auto_mining_remaining": max(0, remaining),
        }

    mined = harvest_mining(profile)
    from accounts.models import UserProfile
    UserProfile.objects.filter(pk=profile.pk).update(
        is_mining=False, mining_started_at=None, last_mining_toggle=timezone.now()
    )
    profile.refresh_from_db()
    _record_mining_toggle(profile)
    return {
        "mined": mined, "balance": profile.balance,
        "energy": profile.energy, "is_mining": False, "cooldown_remaining": 0,
    }


def update_leaderboard(profile):
    from django.core.cache import cache
    from season.models import Season

    try:
        redis_client = cache.client.get_client()
    except AttributeError:
        # Non-Redis cache backend (e.g. LocMemCache) — skip Redis leaderboard update
        return

    active_season = Season.objects.filter(is_active=True).first()
    if active_season:
        key = f"leaderboard:season:{active_season.id}"
    else:
        key = "leaderboard:global"

    try:
        redis_client.zadd(key, {str(profile.telegram_id): float(profile.balance)})
        # Clear DB cache when leaderboard changes
        cache.delete_many([f"leaderboard:db:100:0", f"leaderboard:db:30:0"])
    except Exception:
        pass
