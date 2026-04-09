from rest_framework import serializers

from .models import UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="telegram_username", read_only=True)
    max_energy = serializers.IntegerField(read_only=True)
    network_multiplier = serializers.FloatField(read_only=True)
    referral_count = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            "telegram_id",
            "username",
            "avatar_url",
            "balance",
            "week_earned",
            "month_earned",
            "season_balance",
            "networth",
            "lifetime_balance",
            "energy",
            "max_energy",
            "generation",
            "rank_score",
            "is_mining",
            "aggressor_level",
            "fights_left",
            "is_verified",
            "referral_code",
            "network_tier",
            "network_multiplier",
            "referral_count",
            "auto_mining_until",
            "turbo_boost_until",
        ]
        read_only_fields = fields

    def get_referral_count(self, obj):
        return obj.referrals.count()


class PublicProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="telegram_username", read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            "telegram_id",
            "username",
            "balance",
            "generation",
            "rank_score",
            "aggressor_level",
            "network_tier",
        ]
        read_only_fields = fields
