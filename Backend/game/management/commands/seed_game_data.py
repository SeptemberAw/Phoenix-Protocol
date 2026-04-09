from django.core.management.base import BaseCommand

from economy.models import Quest
from game.models import NetworkTier, UpgradeConfig


class Command(BaseCommand):
    help = "Seed UpgradeConfig, Quest, and NetworkTier data for Purex Protocol"

    def handle(self, *args, **options):
        self._seed_upgrades()
        self._seed_quests()
        self._seed_network_tiers()
        self.stdout.write(self.style.SUCCESS("✅ All game data seeded successfully!"))

    def _seed_upgrades(self):
        upgrades = [
            {
                "config_id": "u1",
                "name": "Neural Buffer",
                "description": "Increases maximum energy capacity of your node.",
                "category": "energy",
                "base_cost": 1000,
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
                "base_cost": 2500,
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
                "base_cost": 1500,
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
                "base_cost": 10000,
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
            status = "CREATED" if created else "UPDATED"
            self.stdout.write(f"  Upgrade {obj.config_id}: {obj.name} [{status}]")

    def _seed_quests(self):
        quests = [
            {
                "type": "social",
                "title": "Protocol Initiation",
                "description": "Join the official secure broadcast channel for updates.",
                "reward": 5000,
                "icon_key": "send",
                "action_url": "https://t.me/purexprotocol",
                "target_progress": 1,
                "button_label": "Join Channel",
                "sort_order": 1,
            },
            {
                "type": "social",
                "title": "Neural Link X",
                "description": "Follow the protocol architect on X (Twitter).",
                "reward": 7500,
                "icon_key": "twitter",
                "action_url": "https://twitter.com/purexprotocol",
                "target_progress": 1,
                "button_label": "Follow X",
                "sort_order": 2,
            },
            {
                "type": "referral",
                "title": "Network Expansion",
                "description": "Invite 3 active operators to the grid.",
                "reward": 25000,
                "icon_key": "users",
                "action_url": "",
                "target_progress": 3,
                "button_label": "Invite Operators",
                "sort_order": 3,
            },
            {
                "type": "wallet",
                "title": "Wallet Synchronization",
                "description": "Link your non-custodial TON wallet for rewards.",
                "reward": 50000,
                "icon_key": "wallet",
                "action_url": "",
                "target_progress": 1,
                "button_label": "Connect TON",
                "sort_order": 4,
            },
        ]

        for data in quests:
            obj, created = Quest.objects.update_or_create(
                title=data["title"],
                defaults=data,
            )
            status = "CREATED" if created else "UPDATED"
            self.stdout.write(f"  Quest: {obj.title} [{status}]")

    def _seed_network_tiers(self):
        tiers = [
            {
                "name": "Neural Link",
                "multiplier": 1.0,
                "requirement_type": "mined_amount",
                "requirement_value": 0,
                "stars_cost": 0,
                "sort_order": 1,
            },
            {
                "name": "Satellite Grid",
                "multiplier": 1.5,
                "requirement_type": "referrals",
                "requirement_value": 5,
                "stars_cost": 0,
                "sort_order": 2,
            },
            {
                "name": "Quantum Mesh",
                "multiplier": 2.0,
                "requirement_type": "mined_amount",
                "requirement_value": 100000,
                "stars_cost": 0,
                "sort_order": 3,
            },
            {
                "name": "Singularity",
                "multiplier": 4.0,
                "requirement_type": "stars_payment",
                "requirement_value": 1,
                "stars_cost": 500,
                "sort_order": 4,
            },
        ]

        for data in tiers:
            obj, created = NetworkTier.objects.update_or_create(
                name=data["name"],
                defaults=data,
            )
            status = "CREATED" if created else "UPDATED"
            self.stdout.write(f"  NetworkTier: {obj.name} x{obj.multiplier} [{status}]")
