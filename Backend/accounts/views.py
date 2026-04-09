from decimal import Decimal
import logging

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from game.services import harvest_mining, regenerate_energy, calculate_max_energy
from pvp.services import get_aggressor_tier
from .authentication import TelegramAuthSerializer
from .models import UserProfile
from .serializers import UserProfileSerializer

logger = logging.getLogger(__name__)

class TelegramAuthView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = []

    def post(self, request):
        serializer = TelegramAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tokens = serializer.save()
        return Response(tokens, status=status.HTTP_200_OK)


class InitView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = []

    def get(self, request):
        from game.models import UpgradeConfig, UserUpgrade
        from game.serializers import UserUpgradeListSerializer
        from economy.models import Quest, UserQuest
        from economy.serializers import UserQuestSerializer

        with transaction.atomic():
            try:
                profile = request.user.profile
            except UserProfile.DoesNotExist:
                # Create profile if it doesn't exist
                profile = UserProfile.objects.create(
                    user=request.user,
                    telegram_id=request.user.username,
                    telegram_username=request.user.first_name,
                    energy=settings.ENERGY_DEFAULT,
                    max_energy=settings.MAX_ENERGY_DEFAULT,
                )
                logger.info(f"🆕 Created profile for user {request.user.username}")
                
                # Check for pending referral from bot /start command
                from .services import get_pending_referral
                pending = get_pending_referral(int(request.user.username))
                if pending:
                    logger.info(f"🔍 Found pending referral for {request.user.username}: {pending}")
                    # Don't apply yet - wait for verification
                else:
                    logger.info(f"ℹ️ No pending referral for {request.user.username}")

            # --- Offline sync: energy regen + passive income ---
            now = timezone.now()
            delta_seconds = (now - profile.last_sync_time).total_seconds()

            # Harvest any ongoing mining first
            harvest_mining(profile)

            # Regenerate energy if not mining
            regenerate_energy(profile)

            # Passive income from Auto-Sync Bot (category='passive')
            passive_income = Decimal("0")
            try:
                auto_bot = UserUpgrade.objects.get(
                    user=profile, config__config_id="u4"
                )
                if auto_bot.level > 0:
                    passive_rate = Decimal(str(auto_bot.level)) * Decimal("0.1")
                    gen_mult = Decimal(str(1.5 ** (profile.generation - 1)))
                    # Cap offline income at 8 hours (28800 seconds)
                    capped_seconds = min(delta_seconds, 28800)
                    passive_income = passive_rate * gen_mult * Decimal(str(capped_seconds))
                    profile.balance += passive_income
                    profile.week_earned += passive_income
                    profile.month_earned += passive_income
                    profile.season_balance += passive_income
                    profile.networth += passive_income
                    profile.lifetime_balance += passive_income  # legacy
            except UserUpgrade.DoesNotExist:
                pass

            profile.last_sync_time = now
            profile.save()

        # --- Build response ---
        upgrades = UserUpgrade.objects.filter(user=profile).select_related("config")
        all_configs = UpgradeConfig.objects.filter(is_active=True)
        upgrade_data = UserUpgradeListSerializer(
            all_configs, many=True, context={"user_upgrades": {u.config_id: u.level for u in upgrades}, "profile": profile}
        ).data

        user_quests = UserQuest.objects.filter(user=profile).select_related("quest")
        active_quests = Quest.objects.filter(is_active=True)
        quest_map = {uq.quest_id: uq for uq in user_quests}
        quest_data = []
        for q in active_quests:
            uq = quest_map.get(q.id)
            quest_data.append(
                UserQuestSerializer(q, context={"user_quest": uq, "profile": profile}).data
            )

        # Total player count for dynamic "online" display
        total_players = UserProfile.objects.filter(is_banned=False).count()

        response_data = {
            "user": UserProfileSerializer(profile).data,
            "upgrades": upgrade_data,
            "active_quests": quest_data,
            "bot_username": settings.TELEGRAM_BOT_USERNAME,
            "referral_bonus_percent": settings.REFERRAL_BONUS_PERCENT,
            "total_players": total_players,
            "aggressor_tier": get_aggressor_tier(profile),
            "daily_attacks_initiated": profile.daily_attacks_initiated,
        }

        # Include passive income notification if applicable
        if passive_income > 0:
            response_data["passive_income"] = str(passive_income)
            hours_away = int(delta_seconds // 3600)
            minutes_away = int((delta_seconds % 3600) // 60)
            response_data["away_message"] = (
                f"While you were away ({hours_away}h {minutes_away}m), "
                f"Auto-Sync Bot mined {passive_income:.2f} PUREX for you!"
            )

        return Response(response_data)


class SupportLookupView(APIView):
    """Internal endpoint for support bot to fetch user profile by telegram_id.
    Protected by X-Support-Key header matching SUPPORT_API_KEY setting."""
    permission_classes = [AllowAny]

    def get(self, request):
        api_key = getattr(settings, "SUPPORT_API_KEY", "")
        provided = request.headers.get("X-Support-Key", "")
        if not api_key or provided != api_key:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        telegram_id = request.query_params.get("telegram_id")
        if not telegram_id:
            return Response({"detail": "telegram_id required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            profile = UserProfile.objects.get(telegram_id=int(telegram_id))
        except (UserProfile.DoesNotExist, ValueError):
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "telegram_id": profile.telegram_id,
            "username": profile.telegram_username,
            "balance": str(profile.balance),
            "week_earned": str(profile.week_earned),
            "month_earned": str(profile.month_earned),
            "season_balance": str(profile.season_balance),
            "networth": str(profile.networth),
            "lifetime_balance": str(profile.lifetime_balance),
            "generation": profile.generation,
            "energy": profile.energy,
            "max_energy": profile.max_energy,
            "is_mining": profile.is_mining,
            "is_verified": profile.is_verified,
            "fights_left": profile.fights_left,
            "network_tier": profile.network_tier,
            "aggressor_level": profile.aggressor_level,
        })
