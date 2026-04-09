import json
import logging
from decimal import Decimal

import requests
from django.conf import settings
from django.db import transaction
from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserProfile
from core.permissions import IsNotBanned
from economy.services import log_transaction
from pvp.models import PvPConfig

from .models import PaymentTransaction
from .serializers import (
    CreateInvoiceSerializer,
    TonVerifySerializer,
    VerifyPaymentSerializer,
    WalletSaveSerializer,
    WebhookPayloadSerializer,
)
from .ton_service import verify_ton_payment

logger = logging.getLogger(__name__)

# ── Stars config ──
STARS_PRICES = {
    "verification": 100,
    "fight_refill": 150,
    "energy_boost": 50,
    "multitap": 100,
    "autobot": 200,
    "network_tier_satellite": 100,
    "network_tier_quantum": 250,
    "network_tier_singularity": 500,
    "pvp_recovery": 50,
}

STARS_TITLES = {
    "verification": "Identity Verification",
    "fight_refill": "Fight Refill",
    "energy_boost": "Energy Recharge",
    "multitap": "Turbo Uplink x2",
    "autobot": "Auto-Miner 24H",
    "network_tier_satellite": "Satellite Grid Uplink",
    "network_tier_quantum": "Quantum Mesh Uplink",
    "network_tier_singularity": "Singularity Uplink",
    "pvp_recovery": "PvP Stake Recovery",
}

STARS_DESCRIPTIONS = {
    "verification": "Verify your identity to unlock mining and PvP",
    "fight_refill": "Refill your daily fight attempts",
    "energy_boost": "Full energy recharge to max capacity",
    "multitap": "Double mining rate for 24 hours",
    "autobot": "Automatic mining for 24 hours",
    "network_tier_satellite": "Upgrade to Satellite Grid (x1.5)",
    "network_tier_quantum": "Upgrade to Quantum Mesh (x2.0)",
    "network_tier_singularity": "Upgrade to Singularity (x4.0)",
    "pvp_recovery": "Recover your lost PvP stake",
}


def _credit_payment(profile, payment_type: str) -> dict:
    """Apply the purchased item to the user profile. Returns updated fields."""
    updated = {}

    if payment_type == "verification":
        profile.is_verified = True
        profile.save(update_fields=["is_verified"])
        log_transaction(profile, "payment", Decimal("0"), "Identity verification completed")

    elif payment_type == "fight_refill":
        config = PvPConfig.load()
        profile.fights_left = config.daily_fight_limit
        profile.save(update_fields=["fights_left"])
        log_transaction(profile, "payment", Decimal("0"), "Fight refill purchased")

    elif payment_type == "energy_boost":
        profile.energy = profile.max_energy
        profile.save(update_fields=["energy"])
        log_transaction(profile, "payment", Decimal("0"), "Energy boost purchased")

    elif payment_type == "multitap":
        profile.turbo_boost_until = timezone.now() + timedelta(hours=24)
        profile.save(update_fields=["turbo_boost_until"])
        log_transaction(profile, "payment", Decimal("0"), "Turbo uplink x2 purchased (24H)")
        updated["turbo_boost_until"] = profile.turbo_boost_until.isoformat()

    elif payment_type == "autobot":
        profile.auto_mining_until = timezone.now() + timedelta(hours=24)
        profile.is_mining = True
        profile.mining_started_at = timezone.now()
        profile.save(update_fields=["auto_mining_until", "is_mining", "mining_started_at"])
        log_transaction(profile, "payment", Decimal("0"), "Auto-miner purchased (24H)")
        updated["auto_mining_until"] = profile.auto_mining_until.isoformat()

    elif payment_type.startswith("network_tier"):
        tier_map = {
            "network_tier_satellite": "Satellite Grid",
            "network_tier_quantum": "Quantum Mesh",
            "network_tier_singularity": "Singularity",
            "network_tier": "Satellite Grid",
        }
        new_tier = tier_map.get(payment_type, "Satellite Grid")
        profile.network_tier = new_tier
        profile.save(update_fields=["network_tier"])
        log_transaction(profile, "payment", Decimal("0"), f"Network tier upgraded to {new_tier}")
        updated["network_tier"] = new_tier

    elif payment_type == "pvp_recovery":
        log_transaction(profile, "payment", Decimal("0"), "PvP stake recovery")

    updated.update({
        "is_verified": profile.is_verified,
        "fights_left": profile.fights_left,
        "energy": profile.energy,
    })
    return updated


# ─────────────────────────────────────────────────
# Stars Endpoints
# ─────────────────────────────────────────────────

class CreateInvoiceView(APIView):
    """Generate a Telegram Stars invoice link for the given payment type."""
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request):
        serializer = CreateInvoiceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payment_type = serializer.validated_data["payment_type"]
        profile = request.user.profile

        stars_amount = STARS_PRICES.get(payment_type)
        if stars_amount is None:
            return Response({"detail": f"Unknown payment type: {payment_type}"}, status=400)

        title = STARS_TITLES.get(payment_type, "Purchase")
        description = STARS_DESCRIPTIONS.get(payment_type, "Purex Protocol purchase")

        payload = json.dumps({
            "user_id": profile.telegram_id,
            "type": payment_type,
        })

        bot_token = settings.TELEGRAM_BOT_TOKEN
        if not bot_token:
            return Response({"detail": "Bot token not configured"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            resp = requests.post(
                f"https://api.telegram.org/bot{bot_token}/createInvoiceLink",
                json={
                    "title": title,
                    "description": description,
                    "payload": payload,
                    "currency": "XTR",
                    "prices": [{"label": title, "amount": stars_amount}],
                },
                timeout=10,
            )
            data = resp.json()
            if not data.get("ok"):
                logger.error(f"Telegram createInvoiceLink failed: {data}")
                return Response({"detail": "Failed to create invoice"}, status=status.HTTP_502_BAD_GATEWAY)

            return Response({
                "invoice_url": data["result"],
                "stars_amount": stars_amount,
            })

        except requests.RequestException as e:
            logger.error(f"Telegram API request failed: {e}")
            return Response({"detail": "Telegram API unavailable"}, status=status.HTTP_502_BAD_GATEWAY)


class VerifyPaymentView(APIView):
    """Verify a Telegram Stars payment after successful invoice callback."""
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request):
        serializer = VerifyPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payment_type = serializer.validated_data["payment_type"]
        charge_id = serializer.validated_data.get("charge_id", "")

        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)

            # Dedup: prevent double-crediting with same charge_id
            if charge_id and PaymentTransaction.objects.filter(
                telegram_payment_charge_id=charge_id, status="completed"
            ).exists():
                return Response({"detail": "Payment already processed"}, status=400)

            stars_amount = STARS_PRICES.get(payment_type, 0)

            pt = PaymentTransaction.objects.create(
                profile=profile,
                payment_type=payment_type,
                provider="telegram_stars",
                status="completed",
                amount=Decimal(str(stars_amount)),
                telegram_payment_charge_id=charge_id,
                payload={"user_id": profile.telegram_id, "type": payment_type},
                completed_at=timezone.now(),
            )

            updated = _credit_payment(profile, payment_type)

        return Response({
            "detail": f"Payment processed: {payment_type}",
            "provider": "telegram_stars",
            "transaction_id": pt.id,
            **updated,
        })


# ─────────────────────────────────────────────────
# TON Endpoints
# ─────────────────────────────────────────────────

class TonVerifyView(APIView):
    """Verify a TON payment on-chain and credit the user."""
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request):
        serializer = TonVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payment_type = serializer.validated_data["payment_type"]
        tx_hash = serializer.validated_data["tx_hash"]
        sender_address = serializer.validated_data.get("sender_address", "")

        with transaction.atomic():
            profile = UserProfile.objects.select_for_update().get(user=request.user)

            # Resolve expected TON price
            expected_ton = settings.TON_PRICES.get(payment_type)
            if expected_ton is None:
                return Response({"detail": f"Unknown payment type: {payment_type}"}, status=400)

            # On-chain verification
            result = verify_ton_payment(
                profile=profile,
                payment_type=payment_type,
                ton_tx_hash=tx_hash,
                sender_address=sender_address,
                expected_ton=expected_ton,
            )

            if not result["success"]:
                PaymentTransaction.objects.create(
                    profile=profile,
                    payment_type=payment_type,
                    provider="ton",
                    status="failed",
                    ton_tx_hash=tx_hash,
                    payload={"error": result["detail"], "sender": sender_address},
                )
                return Response({"detail": result["detail"]}, status=400)

            # Payment verified — record and credit
            pt = PaymentTransaction.objects.create(
                profile=profile,
                payment_type=payment_type,
                provider="ton",
                status="completed",
                amount=Decimal(str(result.get("tx_value_ton", expected_ton))),
                ton_tx_hash=tx_hash,
                payload={
                    "user_id": profile.telegram_id,
                    "type": payment_type,
                    "sender": sender_address,
                    "tx_value_nano": result.get("tx_value_nano"),
                },
                completed_at=timezone.now(),
            )

            updated = _credit_payment(profile, payment_type)

        return Response({
            "detail": f"TON payment verified: {payment_type}",
            "provider": "ton",
            "transaction_id": pt.id,
            **updated,
        })


class SaveWalletView(APIView):
    """Save the user's connected TON wallet address."""
    permission_classes = [IsAuthenticated, IsNotBanned]

    def post(self, request):
        serializer = WalletSaveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        address = serializer.validated_data["address"]
        profile = request.user.profile
        profile.ton_wallet_address = address
        profile.save(update_fields=["ton_wallet_address"])

        return Response({
            "detail": "Wallet saved",
            "ton_wallet_address": address,
        })

    def delete(self, request):
        profile = request.user.profile
        profile.ton_wallet_address = ""
        profile.save(update_fields=["ton_wallet_address"])
        return Response({"detail": "Wallet disconnected"})


class PaymentPricesView(APIView):
    """Return all payment prices for Stars and TON."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "stars": STARS_PRICES,
            "ton": settings.TON_PRICES,
            "treasury_wallet": settings.TON_TREASURY_WALLET,
        })


# ─────────────────────────────────────────────────
# Telegram Webhook (Stars server-side confirmation)
# ─────────────────────────────────────────────────

class TelegramWebhookView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = []

    def post(self, request):
        serializer = WebhookPayloadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        pre_checkout = data.get("pre_checkout_query")
        if pre_checkout:
            bot_token = settings.TELEGRAM_BOT_TOKEN
            query_id = pre_checkout.get("id")
            if bot_token and query_id:
                try:
                    requests.post(
                        f"https://api.telegram.org/bot{bot_token}/answerPreCheckoutQuery",
                        json={"pre_checkout_query_id": query_id, "ok": True},
                        timeout=5,
                    )
                except requests.RequestException:
                    pass
            return Response({"ok": True})

        message = data.get("message", {})
        successful_payment = message.get("successful_payment")
        if not successful_payment:
            return Response({"ok": True})

        invoice_payload = successful_payment.get("invoice_payload", "{}")
        telegram_charge_id = successful_payment.get("telegram_payment_charge_id", "")
        provider_charge_id = successful_payment.get("provider_payment_charge_id", "")

        try:
            payload = json.loads(invoice_payload)
        except (json.JSONDecodeError, TypeError):
            payload = {}

        user_id = payload.get("user_id")
        payment_type = payload.get("type", "verification")

        if not user_id:
            return Response({"ok": True})

        # Dedup by charge_id
        if telegram_charge_id and PaymentTransaction.objects.filter(
            telegram_payment_charge_id=telegram_charge_id, status="completed"
        ).exists():
            logger.info(f"Webhook dedup: charge_id={telegram_charge_id} already processed")
            return Response({"ok": True})

        try:
            with transaction.atomic():
                profile = UserProfile.objects.select_for_update().get(telegram_id=user_id)

                PaymentTransaction.objects.create(
                    profile=profile,
                    payment_type=payment_type,
                    provider="telegram_stars",
                    status="completed",
                    amount=Decimal(str(successful_payment.get("total_amount", 0))),
                    payload=payload,
                    telegram_payment_charge_id=telegram_charge_id,
                    provider_payment_charge_id=provider_charge_id,
                    completed_at=timezone.now(),
                )

                _credit_payment(profile, payment_type)

        except UserProfile.DoesNotExist:
            logger.warning(f"Webhook: user {user_id} not found")

        return Response({"ok": True})


# ─────────────────────────────────────────────────
# Payment History
# ─────────────────────────────────────────────────

class PaymentHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        payments = PaymentTransaction.objects.filter(profile=request.user.profile)[:50]
        data = [
            {
                "id": p.id,
                "payment_type": p.payment_type,
                "provider": p.provider,
                "status": p.status,
                "amount": str(p.amount),
                "created_at": p.created_at.isoformat(),
                "ton_tx_hash": p.ton_tx_hash or None,
            }
            for p in payments
        ]
        return Response(data)
