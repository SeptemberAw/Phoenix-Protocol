import secrets
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from accounts.models import UserProfile
from economy.services import log_transaction
from game.services import harvest_mining, update_leaderboard

from .models import PvPConfig, PvPMatch


# ─── Aggressor constants ────────────────────────────
AGGRESSOR_INCREASE_ON_ATTACK = 15.0     # attacker gains per fight initiated
AGGRESSOR_DROP_ON_ROBBED_PCT = 0.20     # 20% aggressor drop when robbed by someone
ATTACK_IMMUNITY_MINUTES = 10            # cooldown after being attacked

# Aggressor tier thresholds (daily_attacks_initiated)
TIER_GREEN_MAX = 0    # 0 attacks today → immune, can't be attacked
TIER_YELLOW_MAX = 2   # 1-2 attacks → can be attacked
# 3+ attacks → RED (priority target)


def get_aggressor_tier(profile: UserProfile) -> str:
    """Return aggressor tier: 'green', 'yellow', or 'red'.
    Green (0 attacks today): immune — cannot be attacked.
    Yellow (1-2 attacks): can be attacked.
    Red (3+): priority target in matchmaking.
    """
    if profile.daily_attacks_initiated <= TIER_GREEN_MAX:
        return "green"
    if profile.daily_attacks_initiated <= TIER_YELLOW_MAX:
        return "yellow"
    return "red"


def find_opponent(profile: UserProfile) -> UserProfile | None:
    """Find a valid PvP opponent. ALWAYS returns someone (bot fallback).

    Priority order:
      1. RED-tier real players (3+ attacks today) — priority targets
      2. YELLOW-tier real players (1-2 attacks today)
      3. Bot opponents — guaranteed fallback

    Green-tier players (0 attacks today) are IMMUNE and never appear.
    Balance range: 50%-200% of attacker's balance.
    """
    balance_lower = profile.balance * Decimal("0.5")
    balance_upper = profile.balance * Decimal("2.0")

    config = PvPConfig.load()
    cooldown_cutoff = timezone.now() - timezone.timedelta(minutes=config.cooldown_same_opponent_minutes)
    immunity_cutoff = timezone.now() - timezone.timedelta(minutes=ATTACK_IMMUNITY_MINUTES)

    # Build set of recent opponents (cooldown)
    recent_pairs = (
        PvPMatch.objects.filter(
            Q(attacker=profile) | Q(defender=profile),
            created_at__gte=cooldown_cutoff,
        ).values_list("attacker_id", "defender_id")
    )
    recent_ids = set()
    for a_id, d_id in recent_pairs:
        recent_ids.add(a_id)
        recent_ids.add(d_id)
    recent_ids.discard(profile.pk)

    # Base queryset: real players in balance range, not green (immune)
    base_qs = (
        UserProfile.objects.filter(
            is_bot=False,
            is_banned=False,
            is_verified=True,
            daily_attacks_initiated__gte=1,  # exclude green (immune)
            balance__gte=balance_lower,
            balance__lte=balance_upper,
        )
        .exclude(pk=profile.pk)
        .exclude(pk__in=recent_ids)
    )

    # 1) RED tier first (3+ attacks) — priority targets
    red_candidates = list(
        base_qs.filter(daily_attacks_initiated__gte=3)
        .order_by("-aggressor_level", "?")[:10]
    )
    for c in red_candidates:
        if not _recently_attacked(c, immunity_cutoff):
            return c

    # 2) YELLOW tier (1-2 attacks)
    yellow_candidates = list(
        base_qs.filter(daily_attacks_initiated__gte=1, daily_attacks_initiated__lte=2)
        .order_by("?")[:10]
    )
    for c in yellow_candidates:
        if not _recently_attacked(c, immunity_cutoff):
            return c

    # 3) BOT fallback — guaranteed match
    bot_candidates = list(
        UserProfile.objects.filter(
            is_bot=True,
            is_banned=False,
            balance__gte=balance_lower,
            balance__lte=balance_upper,
        )
        .exclude(pk__in=recent_ids)
        .order_by("?")[:10]
    )
    if bot_candidates:
        return bot_candidates[0]

    # Last resort: ANY bot (ignore balance range)
    any_bot = (
        UserProfile.objects.filter(is_bot=True, is_banned=False)
        .exclude(pk__in=recent_ids)
        .order_by("?")
        .first()
    )
    return any_bot


def _recently_attacked(profile: UserProfile, cutoff) -> bool:
    """Check if this profile was attacked recently (immunity window)."""
    return PvPMatch.objects.filter(defender=profile, created_at__gte=cutoff).exists()


def resolve_pvp(attacker: UserProfile, defender_id: int, wager: Decimal, idempotency_key: str = "") -> dict:
    config = PvPConfig.load()

    with transaction.atomic():
        attacker = UserProfile.objects.select_for_update().get(pk=attacker.pk)
        try:
            # Frontend sends telegram_id, not pk
            defender = UserProfile.objects.select_for_update().get(telegram_id=defender_id)
        except UserProfile.DoesNotExist:
            return {"error": "Opponent not found."}

        if attacker.pk == defender.pk:
            return {"error": "Cannot attack yourself."}

        if not attacker.is_verified and not attacker.is_bot:
            return {"error": "You must be verified to fight."}

        if attacker.fights_left <= 0:
            return {"error": "No fights left today."}

        if wager <= 0:
            return {"error": "Wager must be positive."}

        if wager > attacker.balance:
            return {"error": "Insufficient balance for wager."}

        # Tier-based immunity: green players (0 attacks today) can't be attacked
        if not defender.is_bot:
            defender_tier = get_aggressor_tier(defender)
            if defender_tier == "green":
                return {"error": "Opponent hasn't attacked anyone today and is immune."}

        cooldown_cutoff = timezone.now() - timezone.timedelta(minutes=config.cooldown_same_opponent_minutes)
        recent = PvPMatch.objects.filter(
            attacker=attacker, defender=defender, created_at__gte=cooldown_cutoff
        ).exists()
        if recent:
            return {"error": "Cooldown active for this opponent."}

        harvest_mining(attacker)
        if not defender.is_bot:
            harvest_mining(defender)

        tax_rate = Decimal(str(config.tax_percent)) / Decimal("100")
        tax_burned = wager * tax_rate

        is_shadow_banned = attacker.is_shadow_banned
        if is_shadow_banned:
            win = False
        else:
            win = secrets.randbelow(10000) < int(config.win_chance * 10000)

        if win:
            multiplier = Decimal(str(min(config.win_multiplier, 1.3)))
            winnings = wager * multiplier
            net_win = winnings - tax_burned

            # Balance: attacker gains, defender loses
            attacker.balance += net_win
            defender.balance -= wager
            # Earning trackers (only grow): attacker earned net_win
            attacker.week_earned += net_win
            attacker.month_earned += net_win
            attacker.season_balance += net_win
            attacker.networth += net_win
            attacker.lifetime_balance += net_win  # legacy
            # Defender earning trackers do NOT decrease

            attacker_delta = net_win
            defender_delta = -wager
            result = "win"
        else:
            earned = wager - tax_burned
            # Balance: attacker loses, defender gains
            attacker.balance -= wager
            defender.balance += earned
            # Earning trackers (only grow): defender earned from successful defense
            defender.week_earned += earned
            defender.month_earned += earned
            defender.season_balance += earned
            defender.networth += earned
            defender.lifetime_balance += earned  # legacy
            # Attacker earning trackers do NOT decrease

            attacker_delta = -wager
            defender_delta = earned
            result = "loss"

        if attacker.balance < 0:
            attacker.balance = Decimal("0")
        if defender.balance < 0:
            defender.balance = Decimal("0")

        # ─── Aggressor level + tier tracking ───
        attacker.aggressor_level = min(100, attacker.aggressor_level + AGGRESSOR_INCREASE_ON_ATTACK)
        attacker.daily_attacks_initiated += 1
        attacker.last_attack_at = timezone.now()
        attacker.fights_left -= 1

        # Defender: if robbed, aggressor_level drops by %
        if not defender.is_bot and result == "win":
            drop = defender.aggressor_level * AGGRESSOR_DROP_ON_ROBBED_PCT
            defender.aggressor_level = max(0, defender.aggressor_level - drop)

        attacker.save()
        defender.save()

        match = PvPMatch.objects.create(
            attacker=attacker,
            defender=defender,
            wager=wager,
            result=result,
            attacker_delta=attacker_delta,
            defender_delta=defender_delta,
            tax_burned=tax_burned,
        )

        log_transaction(
            profile=attacker,
            tx_type="pvp_attack",
            amount=attacker_delta,
            detail=f"PvP vs {defender.telegram_id}: {result}, wager={wager}, tax={tax_burned}",
        )
        log_transaction(
            profile=defender,
            tx_type="pvp_defend",
            amount=defender_delta,
            detail=f"PvP from {attacker.telegram_id}: {'loss' if result == 'win' else 'win'}, wager={wager}",
        )

        update_leaderboard(attacker)
        update_leaderboard(defender)

    return {
        "result": result,
        "wager": str(wager),
        "tax_burned": str(tax_burned),
        "balance_change": str(attacker_delta),
        "new_balance": str(attacker.balance),
        "fights_left": attacker.fights_left,
        "aggressor_tier": get_aggressor_tier(attacker),
        "daily_attacks_initiated": attacker.daily_attacks_initiated,
        "opponent": {
            "telegram_id": defender.telegram_id,
            "username": defender.telegram_username,
        },
    }


def admin_attack(target_telegram_id: int, amount: Decimal, reason: str = "Admin raid") -> dict:
    """Admin-initiated attack: deduct balance from a player.
    Used for game balance or punishment. Creates a PvPMatch record.
    """
    with transaction.atomic():
        try:
            target = UserProfile.objects.select_for_update().get(telegram_id=target_telegram_id)
        except UserProfile.DoesNotExist:
            return {"error": "Player not found."}

        if amount <= 0:
            return {"error": "Amount must be positive."}

        if amount > target.balance:
            return {"error": f"Player balance ({target.balance}) is less than amount ({amount})."}

        # Only reduce spendable balance — earning trackers never decrease
        target.balance -= amount
        if target.balance < 0:
            target.balance = Decimal("0")

        target.save()

        log_transaction(
            profile=target,
            tx_type="pvp_defend",
            amount=-amount,
            detail=f"Raided: lost {amount} PUREX. {reason}",
        )

        update_leaderboard(target)

    return {
        "success": True,
        "target": target.telegram_username or str(target.telegram_id),
        "amount_taken": str(amount),
        "new_balance": str(target.balance),
    }
