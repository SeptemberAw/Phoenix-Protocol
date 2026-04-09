from decimal import Decimal

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.serializers import PublicProfileSerializer
from core.permissions import IsNotBanned, IsVerified
from core.utils import IdempotencyConflictException, check_idempotency

from .serializers import PvPResolveSerializer
from .services import find_opponent, get_aggressor_tier, resolve_pvp


class PvPSearchView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request):
        profile = request.user.profile
        opponent = find_opponent(profile)
        if opponent is None:
            return Response(
                {"detail": "No opponents available right now."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({
            "opponent": PublicProfileSerializer(opponent).data,
            "attacker_tier": get_aggressor_tier(profile),
        })


class PvPResolveView(APIView):
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request):
        serializer = PvPResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        idem_key = serializer.validated_data.get("idempotency_key")
        if idem_key and check_idempotency(f"pvp:{request.user.pk}:{idem_key}"):
            raise IdempotencyConflictException()

        profile = request.user.profile
        result = resolve_pvp(
            attacker=profile,
            defender_id=serializer.validated_data["opponent_id"],
            wager=serializer.validated_data["wager"],
            idempotency_key=idem_key or "",
        )

        if "error" in result:
            return Response({"detail": result["error"]}, status=status.HTTP_400_BAD_REQUEST)

        return Response(result)
