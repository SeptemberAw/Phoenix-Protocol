from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserProfile
from core.permissions import IsNotBanned
from game.services import update_leaderboard

from .models import Quest, TransactionHistory, UserQuest
from .serializers import ClaimQuestSerializer, TransactionHistorySerializer
from .services import log_transaction


class TransactionListView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]

    def get(self, request):
        profile = request.user.profile
        tx_type = request.query_params.get("type")
        limit = min(int(request.query_params.get("limit", 50)), 200)

        qs = TransactionHistory.objects.filter(profile=profile)
        if tx_type:
            qs = qs.filter(tx_type=tx_type)
        qs = qs[:limit]

        return Response(TransactionHistorySerializer(qs, many=True).data)


class QuestClaimView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request):
        serializer = ClaimQuestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quest_id = serializer.validated_data["quest_id"]

        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)

            try:
                quest = Quest.objects.get(pk=quest_id, is_active=True)
            except Quest.DoesNotExist:
                return Response({"detail": "Quest not found."}, status=status.HTTP_404_NOT_FOUND)

            user_quest, created = UserQuest.objects.get_or_create(
                user=profile, quest=quest, defaults={"progress": 0}
            )

            if user_quest.is_claimed:
                return Response({"detail": "Already claimed."}, status=status.HTTP_400_BAD_REQUEST)

            if quest.type == "referral":
                user_quest.progress = profile.referrals.count()
            elif quest.type == "social":
                user_quest.progress = quest.target_progress
            elif quest.type == "wallet":
                user_quest.progress = quest.target_progress if profile.is_verified else 0
            elif quest.type == "daily":
                user_quest.progress = quest.target_progress

            if user_quest.progress < quest.target_progress:
                user_quest.save()
                return Response(
                    {"detail": "Quest not yet complete.", "progress": user_quest.progress, "target": quest.target_progress},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            reward_amount = Decimal(str(quest.reward))
            profile.balance += reward_amount
            profile.week_earned += reward_amount
            profile.month_earned += reward_amount
            profile.season_balance += reward_amount
            profile.networth += reward_amount
            profile.lifetime_balance += reward_amount  # legacy
            profile.save()

            user_quest.is_claimed = True
            user_quest.completed_at = timezone.now()
            user_quest.save()

            log_transaction(
                profile=profile,
                tx_type="quest_reward",
                amount=reward,
                detail=f"Quest claimed: {quest.title}",
            )
            update_leaderboard(profile)

        return Response({
            "detail": "Quest reward claimed.",
            "reward": str(reward),
            "balance": str(profile.balance),
        })


class ReferralListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = request.user.profile
        # Only count verified referrals (users who paid and got verified)
        verified_referrals = UserProfile.objects.filter(
            referred_by=profile, is_verified=True
        ).values("telegram_id", "telegram_username", "balance", "created_at")
        # Total pending (not yet verified)
        pending_count = UserProfile.objects.filter(
            referred_by=profile, is_verified=False
        ).count()
        return Response({
            "referral_code": profile.referral_code,
            "count": verified_referrals.count(),
            "pending_count": pending_count,
            "referrals": list(verified_referrals),
        })
