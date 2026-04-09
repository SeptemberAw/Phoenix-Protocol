"""
Management command to generate semi-alive bot opponents for PvP.

Bots have real UserUpgrade entries so their mining power is calculated
the same way as real players. A Celery task periodically grows their
balance based on that power.

Usage:
  python manage.py generate_bots --count 50
  python manage.py generate_bots --count 50 --min-balance 100000 --max-balance 50000000
  python manage.py generate_bots --from-file bot_ids.txt
  python manage.py generate_bots --clear
"""
import random
import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from accounts.models import UserProfile
from game.models import UpgradeConfig, UserUpgrade

User = get_user_model()

BOT_USERNAMES = [
    "CryptoMiner_X", "NodeRunner42", "HashKing", "QuantumOps", "DarkPool_7",
    "SatoshiFan", "BlockSmith", "NeonVault", "CipherNode", "ByteHunter",
    "ProtoBreaker", "NetSurge", "DataForge", "PixelMiner", "WaveRunner",
    "ZeroDay_Op", "GhostNode", "IronHash", "FluxCore", "TurboMine",
    "SilentOp", "RogueNode", "DeepMine", "VortexHash", "OmegaCore",
    "AlphaSync", "NovaMiner", "PulseNet", "EchoVault", "DriftOp",
    "HyperNode", "StormHash", "NexusMine", "ArcticOp", "BlazeMiner",
    "ThunderSync", "ShadowHash", "CosmicOp", "TitanMine", "ZenithNode",
    "AuroraSync", "PhantomOp", "SpectraMine", "RadiantHash", "PrismNode",
    "StellarOp", "GalacticSync", "NebulaMine", "InfinityHash", "QuantaNode",
    "VectorSync", "MatrixMine", "CyberHash", "DigitalOp", "VirtualNode",
    "TechSync", "CodeMine", "LogicHash", "SystemOp", "KernelNode",
    "RuntimeSync", "CompileMine", "ParseHash", "StackOp", "HeapNode",
    "BufferSync", "CacheMine", "ThreadHash", "ProcessOp", "DaemonNode",
    "SocketSync", "PacketMine", "StreamHash", "PipeOp", "ShellNode",
    "TerminalSync", "ConsoleMine", "PromptHash", "InputOp", "OutputNode",
]

NETWORK_TIERS = ["Neural Link", "Satellite Grid", "Quantum Mesh", "Singularity"]

# Upgrade level ranges per "power tier" (casual → whale)
BOT_TIERS = [
    # (weight, gen_range, u1_range, u2_range, u3_range, u4_range, balance_range)
    (30, (1, 2), (0, 5),  (0, 3),  (0, 3),  (0, 1),  (10_000, 500_000)),        # casual
    (30, (2, 4), (3, 10), (2, 7),  (2, 5),  (0, 3),  (200_000, 5_000_000)),     # active
    (20, (3, 6), (6, 15), (4, 10), (3, 7),  (1, 5),  (1_000_000, 50_000_000)),  # grinder
    (15, (5, 8), (10, 20),(7, 15), (5, 10), (3, 8),  (10_000_000, 200_000_000)),# whale
    (5,  (7, 10),(15, 20),(10, 15),(7, 10), (5, 10), (50_000_000, 500_000_000)),# elite
]


def _rand_range(r):
    return random.randint(r[0], r[1])


class Command(BaseCommand):
    help = "Generate semi-alive bot opponents with real upgrades for PvP"

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=50, help="Number of bots")
        parser.add_argument("--min-balance", type=int, default=0, help="Override min balance (0=use tier defaults)")
        parser.add_argument("--max-balance", type=int, default=0, help="Override max balance (0=use tier defaults)")
        parser.add_argument("--from-file", type=str, help="File with telegram IDs (one per line)")
        parser.add_argument("--clear", action="store_true", help="Remove all bot accounts")

    def handle(self, *args, **options):
        if options["clear"]:
            count = UserProfile.objects.filter(is_bot=True).count()
            # CASCADE deletes UserUpgrade entries too
            UserProfile.objects.filter(is_bot=True).delete()
            self.stdout.write(self.style.SUCCESS(f"Deleted {count} bot accounts."))
            return

        # Load upgrade configs
        upgrade_configs = {uc.config_id: uc for uc in UpgradeConfig.objects.all()}
        if not upgrade_configs:
            self.stderr.write(self.style.ERROR("No UpgradeConfig found! Run seed_game_data first."))
            return

        count = options["count"]
        override_min = options["min_balance"]
        override_max = options["max_balance"]

        telegram_ids = []
        if options["from_file"]:
            try:
                with open(options["from_file"], "r") as f:
                    for line in f:
                        line = line.strip()
                        if line and line.isdigit():
                            telegram_ids.append(int(line))
                count = len(telegram_ids)
                self.stdout.write(f"Loaded {count} telegram IDs from file.")
            except FileNotFoundError:
                self.stderr.write(self.style.ERROR(f"File not found: {options['from_file']}"))
                return

        tier_weights = [t[0] for t in BOT_TIERS]
        created = 0
        skipped = 0

        for i in range(count):
            tg_id = telegram_ids[i] if telegram_ids else random.randint(900000000, 999999999)

            if UserProfile.objects.filter(telegram_id=tg_id).exists():
                skipped += 1
                continue

            # Pick bot tier
            tier = random.choices(BOT_TIERS, weights=tier_weights, k=1)[0]
            _, gen_r, u1_r, u2_r, u3_r, u4_r, bal_r = tier

            generation = _rand_range(gen_r)
            u1_lvl = min(_rand_range(u1_r), upgrade_configs.get("u1", type("X", (), {"max_level": 20})).max_level)
            u2_lvl = min(_rand_range(u2_r), upgrade_configs.get("u2", type("X", (), {"max_level": 15})).max_level)
            u3_lvl = min(_rand_range(u3_r), upgrade_configs.get("u3", type("X", (), {"max_level": 10})).max_level)
            u4_lvl = min(_rand_range(u4_r), upgrade_configs.get("u4", type("X", (), {"max_level": 10})).max_level)

            if override_min and override_max:
                balance = Decimal(str(random.randint(override_min, override_max)))
            else:
                balance = Decimal(str(random.randint(bal_r[0], bal_r[1])))

            username = BOT_USERNAMES[i] if i < len(BOT_USERNAMES) else f"Node_{tg_id % 100000}"
            network_tier = random.choices(NETWORK_TIERS, weights=[40, 30, 20, 10])[0]

            # Earning trackers
            week_earned = balance * Decimal(str(random.uniform(0.05, 0.15)))
            month_earned = balance * Decimal(str(random.uniform(0.2, 0.4)))
            season_bal = balance * Decimal(str(random.uniform(0.5, 0.7)))
            networth_val = balance + Decimal(str(random.randint(0, max(1, int(balance * Decimal("0.5"))))))

            django_user = User.objects.create_user(
                username=f"bot_{tg_id}",
                password=uuid.uuid4().hex,
            )

            profile = UserProfile.objects.create(
                user=django_user,
                telegram_id=tg_id,
                telegram_username=username,
                balance=balance,
                week_earned=week_earned,
                month_earned=month_earned,
                season_balance=season_bal,
                networth=networth_val,
                lifetime_balance=networth_val,
                generation=generation,
                aggressor_level=0,
                daily_attacks_initiated=0,
                fights_left=5,
                is_verified=True,
                is_bot=True,
                network_tier=network_tier,
                referral_code=uuid.uuid4().hex[:12],
            )

            # Create real UserUpgrade entries
            upgrade_levels = {"u1": u1_lvl, "u2": u2_lvl, "u3": u3_lvl, "u4": u4_lvl}
            for config_id, level in upgrade_levels.items():
                if config_id in upgrade_configs and level > 0:
                    UserUpgrade.objects.create(
                        user=profile,
                        config=upgrade_configs[config_id],
                        level=level,
                    )

            created += 1

        # Referral network between bots
        all_bots = list(UserProfile.objects.filter(is_bot=True).values_list("id", flat=True))
        if len(all_bots) > 2:
            UserProfile.objects.filter(id__in=all_bots).update(referred_by=None)
            num_referrers = max(2, int(len(all_bots) * random.uniform(0.25, 0.35)))
            referrer_ids = random.sample(all_bots, num_referrers)
            follower_ids = [b for b in all_bots if b not in referrer_ids]
            assigned = 0
            for fid in follower_ids:
                UserProfile.objects.filter(id=fid).update(referred_by_id=random.choice(referrer_ids))
                assigned += 1
            self.stdout.write(f"  Assigned {assigned} referral links across {num_referrers} referrers.")

        self.stdout.write(self.style.SUCCESS(
            f"Created {created} bots (skipped {skipped}). Each has real upgrades for mining power simulation."
        ))
