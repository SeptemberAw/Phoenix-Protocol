from decimal import Decimal

from rest_framework import serializers

from .models import NetworkTier, UpgradeConfig


class UpgradeConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = UpgradeConfig
        fields = [
            "config_id", "name", "description", "category",
            "base_cost", "cost_multiplier", "max_level", "benefit_per_level",
        ]


class UserUpgradeListSerializer(serializers.ModelSerializer):
    current_level = serializers.SerializerMethodField()
    next_cost = serializers.SerializerMethodField()
    id = serializers.CharField(source="config_id")

    class Meta:
        model = UpgradeConfig
        fields = [
            "id", "name", "description", "category",
            "base_cost", "cost_multiplier", "max_level",
            "benefit_per_level", "current_level", "next_cost",
        ]

    def get_current_level(self, obj):
        user_upgrades = self.context.get("user_upgrades", {})
        return user_upgrades.get(obj.id, 0)

    def get_next_cost(self, obj):
        level = self.get_current_level(obj)
        if level >= obj.max_level:
            return None
        profile = self.context.get("profile")
        gen = profile.generation if profile else 1
        cost = obj.base_cost * (Decimal("2") ** (gen - 1)) * (Decimal(str(obj.cost_multiplier)) ** level)
        return str(cost.quantize(Decimal("0.0001")))


class BuyUpgradeSerializer(serializers.Serializer):
    upgrade_id = serializers.CharField()
    idempotency_key = serializers.CharField(required=False, default="")


class AscendSerializer(serializers.Serializer):
    pass


class NetworkTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = NetworkTier
        fields = ["name", "multiplier", "requirement_type", "requirement_value", "stars_cost"]


class MiningActionSerializer(serializers.Serializer):
    idempotency_key = serializers.CharField(required=False, default="")
