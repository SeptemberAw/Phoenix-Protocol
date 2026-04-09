from rest_framework import serializers

from .models import Season, SeasonHistory


class SeasonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Season
        fields = ["id", "name", "number", "is_active", "started_at", "ended_at"]
        read_only_fields = fields


class SeasonHistorySerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="profile.telegram_username", read_only=True)
    telegram_id = serializers.IntegerField(source="profile.telegram_id", read_only=True)

    class Meta:
        model = SeasonHistory
        fields = ["season", "telegram_id", "username", "final_balance", "final_rank", "final_generation"]
        read_only_fields = fields
