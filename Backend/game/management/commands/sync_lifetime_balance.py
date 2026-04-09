"""
One-time fix: sync lifetime_balance for all players who have
balance or season_balance > lifetime_balance.

This fixes the bug where lifetime_balance was never updated during gameplay.

Usage:
  python manage.py sync_lifetime_balance
  python manage.py sync_lifetime_balance --dry-run
"""
from django.core.management.base import BaseCommand
from django.db.models import F
from django.db.models.functions import Greatest

from accounts.models import UserProfile


class Command(BaseCommand):
    help = "Sync lifetime_balance = max(balance, season_balance, lifetime_balance) for all players"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Show what would change without saving")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        # Find all profiles where balances are inconsistent
        all_profiles = UserProfile.objects.all()
        broken = []
        for p in all_profiles:
            bal = max(p.balance, 0)
            season = max(p.season_balance, 0)
            lifetime = max(p.lifetime_balance, 0)
            correct_season = max(bal, season)
            correct_lifetime = max(bal, season, lifetime)
            if p.season_balance != correct_season or p.lifetime_balance != correct_lifetime or p.balance < 0 or p.season_balance < 0:
                broken.append((p, correct_season, correct_lifetime))

        self.stdout.write(f"Found {len(broken)} profiles with inconsistent balances.")

        if dry_run:
            for p, cs, cl in broken[:20]:
                self.stdout.write(
                    f"  {p.telegram_username or p.telegram_id} (bot={p.is_bot}): "
                    f"bal={p.balance}, season={p.season_balance}, lifetime={p.lifetime_balance} "
                    f"→ season={cs}, lifetime={cl}"
                )
            if len(broken) > 20:
                self.stdout.write(f"  ... and {len(broken) - 20} more")
            return

        # Fix hierarchy: season >= balance, lifetime >= season, all >= 0
        # Step 1: Clamp negatives
        from decimal import Decimal
        UserProfile.objects.filter(balance__lt=0).update(balance=Decimal("0"))
        UserProfile.objects.filter(season_balance__lt=0).update(season_balance=Decimal("0"))
        UserProfile.objects.filter(lifetime_balance__lt=0).update(lifetime_balance=Decimal("0"))

        # Step 2: season_balance = max(balance, season_balance)
        UserProfile.objects.filter(season_balance__lt=F("balance")).update(
            season_balance=F("balance")
        )

        # Step 3: lifetime_balance = max(season_balance, lifetime_balance)
        UserProfile.objects.filter(lifetime_balance__lt=F("season_balance")).update(
            lifetime_balance=F("season_balance")
        )

        self.stdout.write(self.style.SUCCESS(f"Fixed {len(broken)} profiles. All balances synced."))
