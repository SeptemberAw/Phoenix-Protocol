import hashlib
import hmac
import time
from urllib.parse import parse_qsl

from django.conf import settings
from django.core.cache import cache
from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler


class PaymentRequiredException(APIException):
    status_code = 402
    default_detail = "Payment required."
    default_code = "payment_required"


class IdempotencyConflictException(APIException):
    status_code = 409
    default_detail = "Duplicate request detected."
    default_code = "idempotency_conflict"


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        response.data["status_code"] = response.status_code
    return response


def validate_telegram_init_data(init_data: str, bot_token: str) -> dict | None:
    parsed = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = parsed.pop("hash", None)
    if not received_hash:
        return None

    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(parsed.items())
    )
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        return None

    auth_date = int(parsed.get("auth_date", 0))
    if abs(time.time() - auth_date) > 86400:
        return None

    return parsed


def check_replay(key: str, ttl: int | None = None) -> bool:
    if ttl is None:
        ttl = getattr(settings, "REPLAY_PROTECTION_TTL", 300)
    cache_key = f"replay:{key}"
    if cache.get(cache_key):
        return True
    cache.set(cache_key, 1, timeout=ttl)
    return False


def check_idempotency(key: str, ttl: int = 60) -> bool:
    cache_key = f"idempotency:{key}"
    if cache.get(cache_key):
        return True
    cache.set(cache_key, 1, timeout=ttl)
    return False
