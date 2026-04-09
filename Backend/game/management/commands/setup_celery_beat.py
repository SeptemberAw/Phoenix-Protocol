import json

from django.core.management.base import BaseCommand
from django_celery_beat.models import CrontabSchedule, IntervalSchedule, PeriodicTask


class Command(BaseCommand):
    help = "Setup Celery Beat periodic tasks"

    def handle(self, *args, **options):
        # Intervals
        every_1m, _ = IntervalSchedule.objects.get_or_create(every=1, period=IntervalSchedule.MINUTES)
        every_5m, _ = IntervalSchedule.objects.get_or_create(every=5, period=IntervalSchedule.MINUTES)
        every_60s, _ = IntervalSchedule.objects.get_or_create(every=60, period=IntervalSchedule.SECONDS)

        # Crontab: daily at 12:00 UTC
        noon_crontab, _ = CrontabSchedule.objects.get_or_create(
            minute="0", hour="12", day_of_week="*",
            day_of_month="*", month_of_year="*",
        )

        # ─── Interval-based tasks ───
        interval_tasks = [
            {
                "name": "Decay aggressor levels",
                "task": "decay_aggressor_levels",
                "interval": every_1m,
            },
            {
                "name": "Simulate bot activity",
                "task": "simulate_bot_activity",
                "interval": every_5m,
            },
            {
                "name": "Auto-stop zero energy miners",
                "task": "auto_stop_zero_energy_miners",
                "interval": every_5m,
            },
            {
                "name": "Generate mining block",
                "task": "generate_block",
                "interval": every_60s,
            },
        ]

        for t in interval_tasks:
            obj, created = PeriodicTask.objects.update_or_create(
                name=t["name"],
                defaults={
                    "task": t["task"],
                    "interval": t["interval"],
                    "crontab": None,
                    "args": json.dumps([]),
                    "enabled": True,
                },
            )
            action = "Created" if created else "Updated"
            self.stdout.write(f"  {action}: {obj.name}")

        # ─── Crontab-based tasks ───
        crontab_tasks = [
            {
                "name": "Reset daily fights (12:00)",
                "task": "reset_daily_fights",
                "crontab": noon_crontab,
            },
        ]

        for t in crontab_tasks:
            obj, created = PeriodicTask.objects.update_or_create(
                name=t["name"],
                defaults={
                    "task": t["task"],
                    "crontab": t["crontab"],
                    "interval": None,
                    "args": json.dumps([]),
                    "enabled": True,
                },
            )
            action = "Created" if created else "Updated"
            self.stdout.write(f"  {action}: {obj.name}")

        # Remove old "Reset daily fights" interval-based task if it exists
        PeriodicTask.objects.filter(name="Reset daily fights").delete()

        self.stdout.write(self.style.SUCCESS("Celery Beat tasks configured."))
