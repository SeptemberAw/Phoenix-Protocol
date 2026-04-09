from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Season, SeasonHistory
from .serializers import SeasonHistorySerializer, SeasonSerializer


class ActiveSeasonView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        season = Season.objects.filter(is_active=True).first()
        if season is None:
            return Response({"detail": "No active season."}, status=404)
        return Response(SeasonSerializer(season).data)


class SeasonHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        season_id = request.query_params.get("season_id")
        if season_id:
            entries = SeasonHistory.objects.filter(season_id=season_id).select_related("profile")[:100]
        else:
            profile = request.user.profile
            entries = SeasonHistory.objects.filter(profile=profile).select_related("season")

        return Response(SeasonHistorySerializer(entries, many=True).data)
