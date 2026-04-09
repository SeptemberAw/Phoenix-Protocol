"""
PvP Celery tasks:
  - simulate_bot_activity: grow bot balances based on their mining power
  - reset_daily_fights: reset fights_left + daily_attacks_initiated at 12:00
  - decay_aggressor_levels: time-based aggressor decay after last attack
"""
import random
from decimal import Decimal

from celery import shared_task
from django.db import transaction
from django.utils import timezone

from accounts.models import UserProfile
from game.services import get_mining_power, update_leaderboard


# ─── Bot simulation config ───────────────────────────
BOT_ACTIVITY_CHANCE = 0.4          # 40% of bots "mine" each tick
BOT_MINE_SECONDS = 300             # simulate 5 min of mining per tick
BOT_BALANCE_JITTER = 0.15         # ±15% randomness on earnings

# ─── Aggressor decay config ──────────────────────────
AGGRESSOR_DECAY_PER_MINUTE = 0.5   # lose 0.5 aggressor per minute since last attack
AGGRESSOR_DECAY_GRACE_MINUTES = 5  # no decay for first 5 min after attack


@shared_task(name="simulate_bot_activity")
def simulate_bot_activity():
    """Periodically grow bot balances based on their real mining power.
    Runs every 5 minutes. ~40% of bots 'mine' each tick for realism.
    """
    bots = list(
        UserProfile.objects.filter(is_bot=True, is_banned=False)
        .select_related("user")
    )
    if not bots:
        return "No bots found"

    updated = 0
    for bot in bots:
        if random.random() > BOT_ACTIVITY_CHANCE:
            continue

        try:
            power = get_mining_power(bot)  # uses real upgrades
        except Exception:
            power = Decimal("0.005")

        # Simulate mining: power * seconds * jitter
        jitter = Decimal(str(1.0 + random.uniform(-BOT_BALANCE_JITTER, BOT_BALANCE_JITTER)))
        earned = power * Decimal(str(BOT_MINE_SECONDS)) * jitter
        earned = max(earned, Decimal("0"))

        if earned > 0:
            bot.balance += earned
            bot.week_earned += earned
            bot.month_earned += earned
            bot.season_balance += earned
            bot.networth += earned
            bot.lifetime_balance += earned
            bot.save(update_fields=[
                "balance", "week_earned", "month_earned",
                "season_balance", "networth", "lifetime_balance",
            ])
            update_leaderboard(bot)
            updated += 1

    return f"Simulated mining for {updated}/{len(bots)} bots"


@shared_task(name="reset_daily_fights")
def reset_daily_fights():
    """Reset fights_left to 5 and daily_attacks_initiated to 0 for ALL players.
    Scheduled to run daily at 12:00.
    """
    count = UserProfile.objects.filter(is_banned=False).update(
        fights_left=5,
        daily_attacks_initiated=0,
    )
    return f"Reset daily fights for {count} players"


@shared_task(name="decay_aggressor_levels")
def decay_aggressor_levels():
    """Time-based aggressor decay. Runs every minute.

    - Grace period: no decay for AGGRESSOR_DECAY_GRACE_MINUTES after last attack
    - After grace: lose AGGRESSOR_DECAY_PER_MINUTE per minute elapsed
    - Only decays players with aggressor_level > 0 and last_attack_at set
    """
    now = timezone.now()
    grace_cutoff = now - timezone.timedelta(minutes=AGGRESSOR_DECAY_GRACE_MINUTES)

    # Players who attacked before the grace period (eligible for decay)
    aggressors = UserProfile.objects.filter(
        aggressor_level__gt=0,
        last_attack_at__isnull=False,
        last_attack_at__lt=grace_cutoff,
        is_banned=False,
    )

    decayed = 0
    for profile in aggressors:
        minutes_since = (now - profile.last_attack_at).total_seconds() / 60.0
        minutes_decaying = minutes_since - AGGRESSOR_DECAY_GRACE_MINUTES
        if minutes_decaying <= 0:
            continue

        total_decay = AGGRESSOR_DECAY_PER_MINUTE * minutes_decaying
        new_level = max(0, profile.aggressor_level - total_decay)

        if new_level != profile.aggressor_level:
            profile.aggressor_level = new_level
            profile.save(update_fields=["aggressor_level"])
            decayed += 1

    return f"Decayed aggressor for {decayed} players"
