import hashlib
import math
from decimal import Decimal

from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserProfile
from accounts.serializers import UserProfileSerializer
from core.permissions import IsNotBanned, IsVerified
from core.utils import IdempotencyConflictException, check_idempotency
from economy.services import log_transaction

from .models import BlockFeed, UpgradeConfig, UserUpgrade
from .serializers import BuyUpgradeSerializer, MiningActionSerializer
from .services import get_mining_power, harvest_mining, start_mining, stop_mining, update_leaderboard, _is_auto_mining_active, _is_turbo_active


def _bot_fake_referrals(telegram_id: int, period: str = "week", balance: float = 0) -> int:
    """Deterministic fake referral count for bots, scaled by period.
    Higher-balance bots get proportionally more referrals.
    week: 3-15, month: 8-45, all: 15-90."""
    seed = int(hashlib.md5(str(telegram_id).encode()).hexdigest()[:8], 16)
    # Base referral from seed (0.0 - 1.0)
    base_frac = (seed % 1000) / 1000.0
    # Balance factor: higher balance → slightly more referrals (log scale)
    bal_factor = 1.0 + min(1.5, math.log10(max(balance, 1)) / 10)
    if period == "week":
        return min(18, max(3, int(3 + base_frac * 12 * bal_factor)))
    elif period == "month":
        return min(50, max(8, int(8 + base_frac * 37 * bal_factor)))
    else:  # all
        return min(100, max(15, int(15 + base_frac * 75 * bal_factor)))


def _estimate_mining_power(profile) -> float:
    """Estimate mining power for a profile without hitting Redis.
    Uses generation, network tier. For bots this is the only option;
    for real players we try the full formula."""
    base = Decimal("0.005")
    gen_mult = Decimal("1.5") ** (profile.generation - 1)
    net_mult = Decimal(str(profile.network_multiplier))
    # Skip league multiplier (requires Redis) — use 1.0 as safe default
    return float(base * gen_mult * net_mult)


class MiningStartView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned, IsVerified]

    def post(self, request):
        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            result = start_mining(profile)

        if not result["started"]:
            resp = {
                "detail": "Cannot start mining.",
                "energy": result["energy"],
                "cooldown_remaining": result["cooldown_remaining"],
            }
            if result["cooldown_remaining"] > 0:
                resp["detail"] = f"Cooldown active: {result['cooldown_remaining']}s remaining."
            return Response(resp, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "detail": "Mining started.",
            "energy": result["energy"],
            "cooldown_remaining": 0,
            "mining_power": str(get_mining_power(profile)),
        })


class MiningStopView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request):
        serializer = MiningActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        idem_key = serializer.validated_data.get("idempotency_key")
        if idem_key and check_idempotency(f"mining_stop:{request.user.pk}:{idem_key}"):
            raise IdempotencyConflictException()

        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            result = stop_mining(profile)

        resp = {
            "detail": "Auto-miner active — cannot stop." if result.get("auto_mining") else "Mining stopped.",
            "mined": str(result["mined"]),
            "balance": str(result["balance"]),
            "energy": result["energy"],
            "is_mining": result["is_mining"],
            "cooldown_remaining": result["cooldown_remaining"],
            "auto_mining": result.get("auto_mining", False),
        }
        if result.get("auto_mining_remaining"):
            resp["auto_mining_remaining"] = result["auto_mining_remaining"]
        return Response(resp)


class MiningHarvestView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]
    throttle_classes = []

    def post(self, request):
        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            mined = harvest_mining(profile)

        from django.utils import timezone as tz
        now = tz.now()
        auto_until = profile.auto_mining_until
        turbo_until = profile.turbo_boost_until
        resp = {
            "mined": str(mined),
            "balance": str(profile.balance),
            "energy": profile.energy,
            "max_energy": profile.max_energy,
            "is_mining": profile.is_mining,
            "mining_power": str(get_mining_power(profile)),
            "auto_mining": bool(auto_until and auto_until > now),
            "turbo_active": bool(turbo_until and turbo_until > now),
        }
        if auto_until and auto_until > now:
            resp["auto_mining_remaining"] = int((auto_until - now).total_seconds())
        if turbo_until and turbo_until > now:
            resp["turbo_remaining"] = int((turbo_until - now).total_seconds())
        return Response(resp)


class UpgradeBuyView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned, IsVerified]

    def post(self, request):
        serializer = BuyUpgradeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        upgrade_id = serializer.validated_data["upgrade_id"]
        idem_key = serializer.validated_data.get("idempotency_key")

        if idem_key and check_idempotency(f"upgrade:{request.user.pk}:{idem_key}"):
            raise IdempotencyConflictException()

        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            harvest_mining(profile)

            try:
                config = UpgradeConfig.objects.get(config_id=upgrade_id, is_active=True)
            except UpgradeConfig.DoesNotExist:
                return Response({"detail": "Upgrade not found."}, status=status.HTTP_404_NOT_FOUND)

            user_upgrade, _ = UserUpgrade.objects.get_or_create(
                user=profile, config=config, defaults={"level": 0}
            )

            if user_upgrade.level >= config.max_level:
                return Response({"detail": "Max level reached."}, status=status.HTTP_400_BAD_REQUEST)

            cost = config.base_cost * (Decimal("2") ** (profile.generation - 1)) * (
                Decimal(str(config.cost_multiplier)) ** user_upgrade.level
            )

            if profile.balance < cost:
                return Response({"detail": "Insufficient balance."}, status=status.HTTP_400_BAD_REQUEST)

            profile.balance -= cost
            user_upgrade.level += 1
            user_upgrade.save()

            if config.category == "energy":
                from game.services import calculate_max_energy
                profile.max_energy = calculate_max_energy(profile)

            profile.save()

            log_transaction(
                profile=profile,
                tx_type="upgrade",
                amount=-cost,
                detail=f"Upgrade {config.config_id} to level {user_upgrade.level}",
            )
            update_leaderboard(profile)

        return Response({
            "balance": str(profile.balance),
            "upgrade_id": config.config_id,
            "new_level": user_upgrade.level,
            "max_energy": profile.max_energy,
        })


class AscendView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned, IsVerified]

    def post(self, request):
        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)
            harvest_mining(profile)

            # Ascension cost: 50000 * 2^(gen-1)
            ascend_cost = Decimal("50000") * (Decimal("2") ** (profile.generation - 1))
            if profile.balance < ascend_cost:
                return Response(
                    {"detail": f"Insufficient balance. Ascension costs {ascend_cost:.0f} PUREX.",
                     "cost": str(ascend_cost)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            profile.balance -= ascend_cost
            profile.generation += 1
            profile.is_mining = False
            profile.mining_started_at = None
            profile.energy = profile.max_energy
            profile.save()

            UserUpgrade.objects.filter(user=profile).update(level=0)

            log_transaction(
                profile=profile,
                tx_type="ascend",
                amount=-ascend_cost,
                detail=f"Ascended to generation {profile.generation}",
            )
            update_leaderboard(profile)

        return Response({
            "generation": profile.generation,
            "balance": str(profile.balance),
            "energy": profile.energy,
            "ascend_cost": str(ascend_cost),
        })


class LeaderboardView(APIView):
    permission_classes = [IsAuthenticated]
    
    PERIOD_FIELDS = {
        "week": "week_earned",
        "month": "month_earned",
        "all": "networth"
    }

    def get(self, request):
        limit = min(int(request.query_params.get("limit", 100)), 200)
        offset = int(request.query_params.get("offset", 0))
        period = request.query_params.get("period", "week")
        if period not in self.PERIOD_FIELDS:
            period = "week"

        return self._db_leaderboard(request, limit, offset, period)

    def _db_leaderboard(self, request, limit, offset, period):
        from django.db.models import Count, Q

        sort_field = self.PERIOD_FIELDS[period]
        profile = request.user.profile

        # Bots appear in game leaderboard (separated only in Django admin)
        base_qs = UserProfile.objects.filter(is_banned=False)

        # Only count verified referrals (paid + verified)
        top_users = (
            base_qs
            .annotate(ref_count=Count("referrals", filter=Q(referrals__is_verified=True)))
            .order_by(f"-{sort_field}")[offset:offset + limit]
        )

        result = []
        for rank_idx, p in enumerate(top_users, start=offset + 1):
            period_score = max(0, float(getattr(p, sort_field)))
            nw = max(0, float(p.networth))
            if p.is_bot:
                ref_count = _bot_fake_referrals(p.telegram_id, period, period_score)
            else:
                ref_count = p.ref_count
            mining_pow = _estimate_mining_power(p)
            result.append({
                "rank": rank_idx,
                "username": p.telegram_username or "Player",
                "balance": round(period_score, 1),
                "networth": round(nw, 1),
                "week_earned": round(max(0, float(p.week_earned)), 1),
                "month_earned": round(max(0, float(p.month_earned)), 1),
                "generation": p.generation,
                "is_current_user": p.user_id == request.user.id,
                "referral_count": ref_count,
                "mining_power": round(mining_pow, 4),
            })

        user_period_score = getattr(profile, sort_field)
        my_rank = base_qs.exclude(pk=profile.pk).filter(**{f"{sort_field}__gt": user_period_score}).count() + 1
        my_month_rank = base_qs.exclude(pk=profile.pk).filter(month_earned__gt=profile.month_earned).count() + 1
        my_week_rank = base_qs.exclude(pk=profile.pk).filter(week_earned__gt=profile.week_earned).count() + 1
        my_all_time_rank = base_qs.exclude(pk=profile.pk).filter(networth__gt=profile.networth).count() + 1

        # Update peak ranks (best = lowest rank number)
        peak_fields_to_save = []
        if my_week_rank > 0 and (profile.peak_week_rank == 0 or my_week_rank < profile.peak_week_rank):
            profile.peak_week_rank = my_week_rank
            peak_fields_to_save.append("peak_week_rank")
        if my_month_rank > 0 and (profile.peak_month_rank == 0 or my_month_rank < profile.peak_month_rank):
            profile.peak_month_rank = my_month_rank
            peak_fields_to_save.append("peak_month_rank")
        if my_all_time_rank > 0 and (profile.peak_all_time_rank == 0 or my_all_time_rank < profile.peak_all_time_rank):
            profile.peak_all_time_rank = my_all_time_rank
            peak_fields_to_save.append("peak_all_time_rank")
        if peak_fields_to_save:
            profile.save(update_fields=peak_fields_to_save)

        my_ref_count = profile.referrals.filter(is_verified=True).count()
        try:
            my_mining_pow = float(get_mining_power(profile))
        except Exception:
            my_mining_pow = _estimate_mining_power(profile)

        return Response({
            "leaderboard": result,
            "my_rank": my_rank,
            "my_score": round(float(user_period_score), 1),
            "my_networth": round(float(profile.networth), 1),
            "my_week_score": round(float(profile.week_earned), 1),
            "my_month_score": round(float(profile.month_earned), 1),
            "my_week_rank": my_week_rank,
            "my_month_rank": my_month_rank,
            "my_all_time_rank": my_all_time_rank,
            "my_peak_week_rank": profile.peak_week_rank,
            "my_peak_month_rank": profile.peak_month_rank,
            "my_peak_all_time_rank": profile.peak_all_time_rank,
            "my_referral_count": my_ref_count,
            "my_mining_power": round(my_mining_pow, 4),
        })


class BlockFeedView(APIView):
    permission_classes = [IsAuthenticated]

    @staticmethod
    def _seed_blocks():
        """Seed initial blocks if table is empty."""
        import random
        from django.utils import timezone
        from datetime import timedelta
        if BlockFeed.objects.exists():
            return
        now = timezone.now()
        nodes = [f"Node_{random.randint(1, 200)}" for _ in range(5)]
        for i in range(5):
            BlockFeed.objects.create(
                block_number=9001 + i,
                block_hash=f"0x{format(random.randint(0, 0xFFFFFF), '06X')}",
                reward=round(random.uniform(3.0, 22.0), 2),
                finder=nodes[i],
                difficulty=f"{random.randint(15, 70)}T",
                participants=random.randint(2, 8),
            )
            # Backdate created_at so they show varied times
            BlockFeed.objects.filter(block_number=9001 + i).update(
                created_at=now - timedelta(seconds=(5 - i) * random.randint(30, 120))
            )

    def get(self, request):
        limit = min(int(request.query_params.get("limit", 10)), 20)
        blocks = BlockFeed.objects.all()[:limit]
        if not blocks.exists():
            self._seed_blocks()
            blocks = BlockFeed.objects.all()[:limit]
        result = []
        for b in blocks:
            result.append({
                "id": b.block_number,
                "hash": b.block_hash,
                "reward": float(b.reward),
                "finder": b.finder,
                "difficulty": b.difficulty,
                "participants": b.participants,
                "created_at": b.created_at.isoformat(),
            })
        return Response({"blocks": result})
