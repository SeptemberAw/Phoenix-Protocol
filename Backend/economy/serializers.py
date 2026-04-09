from rest_framework import serializers

from .models import Quest, TransactionHistory


class TransactionHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionHistory
        fields = ["id", "tx_type", "amount", "balance_after", "detail", "created_at"]
        read_only_fields = fields


class QuestSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quest
        fields = [
            "id", "type", "title", "description", "reward",
            "action_url", "target_progress", "icon_key", "button_label",
        ]


class UserQuestSerializer(serializers.Serializer):
    id = serializers.IntegerField(source="pk")
    type = serializers.CharField()
    title = serializers.CharField()
    description = serializers.CharField()
    reward = serializers.IntegerField()
    icon = serializers.CharField(source="icon_key")
    action_url = serializers.URLField()
    target_progress = serializers.IntegerField()
    button_label = serializers.CharField()
    is_completed = serializers.SerializerMethodField()
    current_progress = serializers.SerializerMethodField()

    def get_is_completed(self, obj):
        uq = self.context.get("user_quest")
        if uq is None:
            return False
        return uq.is_claimed

    def get_current_progress(self, obj):
        uq = self.context.get("user_quest")
        if uq is None:
            if obj.type == "referral":
                profile = self.context.get("profile")
                if profile:
                    return profile.referrals.count()
            return 0
        return uq.progress


class ClaimQuestSerializer(serializers.Serializer):
    quest_id = serializers.IntegerField()
