from decimal import Decimal

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone


@shared_task(name="decay_aggressor_levels")
def decay_aggressor_levels():
    from accounts.models import UserProfile

    profiles = UserProfile.objects.filter(aggressor_level__gt=0)
    for profile in profiles.iterator(chunk_size=500):
        new_level = max(0, profile.aggressor_level - 0.3)
        UserProfile.objects.filter(pk=profile.pk).update(aggressor_level=new_level)


@shared_task(name="reset_daily_fights")
def reset_daily_fights():
    from accounts.models import UserProfile
    from pvp.models import PvPConfig

    config = PvPConfig.load()
    UserProfile.objects.all().update(fights_left=config.daily_fight_limit)


@shared_task(name="end_season")
def end_season(season_id: int):
    from accounts.models import UserProfile
    from game.models import UserUpgrade
    from season.models import Season, SeasonHistory

    try:
        season = Season.objects.get(pk=season_id, is_active=True)
    except Season.DoesNotExist:
        return f"Season {season_id} not found or already ended."

    redis_client = cache.client.get_client()
    leaderboard_key = f"leaderboard:season:{season_id}"

    with transaction.atomic():
        profiles = UserProfile.objects.select_for_update().all()
        entries = redis_client.zrevrange(leaderboard_key, 0, -1, withscores=True)
        rank_map = {}
        for rank_idx, (member, score) in enumerate(entries, start=1):
            rank_map[int(member)] = rank_idx

        history_bulk = []
        for profile in profiles:
            final_rank = rank_map.get(profile.telegram_id, 0)
            history_bulk.append(
                SeasonHistory(
                    season=season,
                    profile=profile,
                    final_balance=profile.season_balance,
                    final_rank=final_rank,
                    final_generation=profile.generation,
                )
            )

            # Reset period trackers for new season
            # networth NEVER resets - it's the all-time peak
            profile.season_balance = Decimal("0")
            profile.week_earned = Decimal("0")
            profile.generation = 1
            profile.energy = settings.ENERGY_DEFAULT
            profile.max_energy = settings.MAX_ENERGY_DEFAULT
            profile.is_mining = False
            profile.mining_started_at = None

        SeasonHistory.objects.bulk_create(history_bulk, ignore_conflicts=True)
        UserUpgrade.objects.all().update(level=0)

        for profile in profiles:
            profile.save()

        season.is_active = False
        season.ended_at = timezone.now()
        season.save()

        redis_client.delete(leaderboard_key)

    return f"Season {season.number} ended successfully."


@shared_task(name="reset_weekly_earnings")
def reset_weekly_earnings():
    """Reset week_earned for all users every Monday."""
    try:
        from accounts.models import UserProfile
        UserProfile.objects.all().update(week_earned=0)
        logger.info("Weekly earnings reset completed")
    except Exception as e:
        logger.error(f"Weekly reset failed: {e}")


@shared_task(name="reset_monthly_earnings")
def reset_monthly_earnings():
    """Reset month_earned for all users every 1st of month."""
    try:
        from accounts.models import UserProfile
        UserProfile.objects.all().update(month_earned=0)
        logger.info("Monthly earnings reset completed")
    except Exception as e:
        logger.error(f"Monthly reset failed: {e}")


@shared_task(name="auto_stop_zero_energy_miners")
def auto_stop_zero_energy_miners():
    from accounts.models import UserProfile
    from game.services import harvest_mining

    miners = UserProfile.objects.filter(is_mining=True, energy__lte=0)
    count = 0
    for profile in miners.iterator(chunk_size=100):
        with transaction.atomic():
            p = UserProfile.objects.select_for_update().get(pk=profile.pk)
            harvest_mining(p)
            if p.energy <= 0:
                p.is_mining = False
                p.mining_started_at = None
                p.save(update_fields=["is_mining", "mining_started_at"])
                count += 1
    return f"Auto-stopped {count} miners with zero energy."
