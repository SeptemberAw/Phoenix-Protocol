"""
TON on-chain payment verification service.

Validates:
  - Transaction exists on-chain
  - Recipient matches treasury wallet
  - Amount matches expected price
  - Payload/comment matches expected format
  - Transaction is unique (not already used)
  - Transaction is not bounced
"""

import hashlib
import logging
import time
from decimal import Decimal

import requests
from django.conf import settings

from .models import PaymentTransaction

logger = logging.getLogger(__name__)

# 1 TON = 1_000_000_000 nanoTON
NANO = 1_000_000_000


def _normalize_address(addr: str) -> str:
    """Strip whitespace and lowercase for comparison."""
    return addr.strip().lower()


def verify_ton_payment(
    profile,
    payment_type: str,
    ton_tx_hash: str,
    sender_address: str,
    expected_ton: float | None = None,
) -> dict:
    """
    Verify a TON payment on-chain and credit the user.

    Returns dict with 'success' bool and 'detail' message.
    """
    treasury = settings.TON_TREASURY_WALLET
    if not treasury:
        return {"success": False, "detail": "Treasury wallet not configured"}

    api_key = settings.TON_API_KEY
    api_base = settings.TON_API_BASE

    # ── 1. Uniqueness check ──
    if PaymentTransaction.objects.filter(ton_tx_hash=ton_tx_hash, status="completed").exists():
        return {"success": False, "detail": "Transaction already processed"}

    # ── 2. Resolve expected amount ──
    if expected_ton is None:
        expected_ton = settings.TON_PRICES.get(payment_type)
    if expected_ton is None:
        return {"success": False, "detail": f"Unknown payment type: {payment_type}"}

    expected_nano = int(expected_ton * NANO)
    # Allow 2% tolerance for network fees
    min_nano = int(expected_nano * 0.98)

    # ── 3. Fetch transaction from TON API ──
    try:
        headers = {}
        if api_key:
            headers["X-API-Key"] = api_key

        # Try to get transaction by hash
        resp = requests.get(
            f"{api_base}/transactions",
            params={
                "hash": ton_tx_hash,
                "limit": 1,
            },
            headers=headers,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

        transactions = data.get("transactions", [])
        if not transactions:
            return {"success": False, "detail": "Transaction not found on-chain"}

        tx = transactions[0]

    except requests.RequestException as e:
        logger.error(f"TON API request failed: {e}")
        return {"success": False, "detail": "TON API unavailable, try again later"}

    # ── 4. Validate bounce status ──
    in_msg = tx.get("in_msg", {})
    if in_msg.get("bounced", False):
        return {"success": False, "detail": "Transaction was bounced"}

    # ── 5. Validate recipient ──
    dest = in_msg.get("destination", "")
    if _normalize_address(dest) != _normalize_address(treasury):
        logger.warning(
            f"TON payment destination mismatch: expected={treasury}, got={dest}"
        )
        return {"success": False, "detail": "Transaction recipient does not match treasury"}

    # ── 6. Validate sender ──
    source = in_msg.get("source", "")
    if sender_address and _normalize_address(source) != _normalize_address(sender_address):
        logger.warning(
            f"TON payment sender mismatch: expected={sender_address}, got={source}"
        )
        return {"success": False, "detail": "Transaction sender does not match connected wallet"}

    # ── 7. Validate amount ──
    tx_value = int(in_msg.get("value", "0"))
    if tx_value < min_nano:
        logger.warning(
            f"TON payment amount too low: expected>={min_nano}, got={tx_value}"
        )
        return {
            "success": False,
            "detail": f"Insufficient amount: expected {expected_ton} TON, got {tx_value / NANO:.4f} TON",
        }

    # ── 8. Validate payload/comment ──
    msg_body = in_msg.get("message", "") or ""
    # Expected payload format: "purex:{payment_type}:{user_telegram_id}"
    expected_payload = f"purex:{payment_type}:{profile.telegram_id}"
    if msg_body.strip() != expected_payload:
        logger.warning(
            f"TON payment payload mismatch: expected='{expected_payload}', got='{msg_body}'"
        )
        return {"success": False, "detail": "Transaction payload does not match"}

    # ── 9. All checks passed — record the payment ──
    return {
        "success": True,
        "detail": "Payment verified",
        "tx_value_nano": tx_value,
        "tx_value_ton": tx_value / NANO,
    }
