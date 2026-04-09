from decimal import Decimal

from django.core.management.base import BaseCommand

from game.models import NetworkTier, UpgradeConfig


class Command(BaseCommand):
    help = "Seed default upgrade configs and network tiers"

    def handle(self, *args, **options):
        upgrades = [
            {
                "config_id": "u1",
                "name": "Neural Buffer",
                "description": "Increases maximum energy capacity of your node.",
                "category": "energy",
                "base_cost": Decimal("1000"),
                "cost_multiplier": 1.5,
                "max_level": 20,
                "benefit_per_level": 500,
                "sort_order": 1,
            },
            {
                "config_id": "u2",
                "name": "Quantum Core",
                "description": "Boosts hashing power per mining cycle.",
                "category": "mining",
                "base_cost": Decimal("2500"),
                "cost_multiplier": 1.8,
                "max_level": 15,
                "benefit_per_level": 0.005,
                "sort_order": 2,
            },
            {
                "config_id": "u3",
                "name": "Rapid Cooling",
                "description": "Accelerates energy regeneration rate when idle.",
                "category": "recharge",
                "base_cost": Decimal("1500"),
                "cost_multiplier": 1.6,
                "max_level": 10,
                "benefit_per_level": 2,
                "sort_order": 3,
            },
            {
                "config_id": "u4",
                "name": "Auto-Sync Bot",
                "description": "Background mining that works even when you sleep.",
                "category": "passive",
                "base_cost": Decimal("10000"),
                "cost_multiplier": 2.5,
                "max_level": 5,
                "benefit_per_level": 0.1,
                "sort_order": 4,
            },
        ]

        for data in upgrades:
            obj, created = UpgradeConfig.objects.update_or_create(
                config_id=data["config_id"],
                defaults=data,
            )
            action = "Created" if created else "Updated"
            self.stdout.write(f"  {action}: {obj}")

        tiers = [
            {"name": "Neural Link", "multiplier": 1.0, "requirement_type": "mined_amount", "requirement_value": 0, "stars_cost": 0, "sort_order": 1},
            {"name": "Satellite Grid", "multiplier": 1.5, "requirement_type": "mined_amount", "requirement_value": 10000, "stars_cost": 0, "sort_order": 2},
            {"name": "Quantum Mesh", "multiplier": 2.0, "requirement_type": "mined_amount", "requirement_value": 100000, "stars_cost": 0, "sort_order": 3},
            {"name": "Singularity", "multiplier": 4.0, "requirement_type": "stars_payment", "requirement_value": 0, "stars_cost": 100, "sort_order": 4},
        ]

        for data in tiers:
            obj, created = NetworkTier.objects.update_or_create(
                name=data["name"],
                defaults=data,
            )
            action = "Created" if created else "Updated"
            self.stdout.write(f"  {action}: {obj}")

        from pvp.models import PvPConfig
        PvPConfig.load()
        self.stdout.write("  PvP config initialized.")

        self.stdout.write(self.style.SUCCESS("Seed complete."))
