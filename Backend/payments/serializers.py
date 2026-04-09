from rest_framework import serializers

ALL_PAYMENT_TYPES = [
    "verification",
    "fight_refill",
    "energy_boost",
    "multitap",
    "autobot",
    "network_tier",
    "network_tier_satellite",
    "network_tier_quantum",
    "network_tier_singularity",
    "pvp_recovery",
]


class CreateInvoiceSerializer(serializers.Serializer):
    payment_type = serializers.ChoiceField(choices=ALL_PAYMENT_TYPES)


class VerifyPaymentSerializer(serializers.Serializer):
    payment_type = serializers.ChoiceField(choices=ALL_PAYMENT_TYPES)
    charge_id = serializers.CharField(required=False, default="")


class TonVerifySerializer(serializers.Serializer):
    payment_type = serializers.ChoiceField(choices=ALL_PAYMENT_TYPES)
    tx_hash = serializers.CharField(max_length=100)
    sender_address = serializers.CharField(max_length=100, required=False, default="")


class WalletSaveSerializer(serializers.Serializer):
    address = serializers.CharField(max_length=100)


class WebhookPayloadSerializer(serializers.Serializer):
    update_id = serializers.IntegerField(required=False)
    pre_checkout_query = serializers.DictField(required=False)
    message = serializers.DictField(required=False)
