from decimal import Decimal

from rest_framework import serializers


class PvPSearchSerializer(serializers.Serializer):
    pass


class PvPResolveSerializer(serializers.Serializer):
    opponent_id = serializers.IntegerField()
    wager = serializers.DecimalField(max_digits=20, decimal_places=4, min_value=Decimal("0"))
    idempotency_key = serializers.CharField(required=False, default="")


class PvPMatchSerializer(serializers.Serializer):
    result = serializers.CharField()
    wager = serializers.CharField()
    tax_burned = serializers.CharField()
    balance_change = serializers.CharField()
    new_balance = serializers.CharField()
    fights_left = serializers.IntegerField()
