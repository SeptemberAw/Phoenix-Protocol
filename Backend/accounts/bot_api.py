from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
import json
import logging

from .models import UserProfile

User = get_user_model()
logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(["POST"])
def bot_start_command(request):
    """
    Called by the bot handler when a user sends /start r_CODE.
    Creates user + profile if needed, sets referred_by immediately.
    Referral only *counts* (Hub, bonus) after the referred user is verified.
    """
    try:
        data = json.loads(request.body)
        bot_token = data.get("bot_token")

        if bot_token != settings.TELEGRAM_BOT_TOKEN:
            return JsonResponse({"error": "Unauthorized"}, status=401)

        telegram_id = data.get("telegram_id")
        referral_code = data.get("referral_code")

        if not telegram_id or not referral_code:
            return JsonResponse({"error": "Missing telegram_id or referral_code"}, status=400)

        # Find referrer
        try:
            referrer = UserProfile.objects.get(referral_code=referral_code)
        except UserProfile.DoesNotExist:
            return JsonResponse({"success": False, "message": "Invalid referral code"}, status=400)

        # Self-referral check
        if referrer.telegram_id == telegram_id:
            return JsonResponse({"success": False, "message": "Cannot refer yourself"}, status=400)

        # Get or create the referred user
        user, _ = User.objects.get_or_create(
            username=str(telegram_id),
            defaults={"first_name": data.get("first_name", "")},
        )
        profile, created = UserProfile.objects.get_or_create(
            user=user,
            defaults={
                "telegram_id": telegram_id,
                "telegram_username": data.get("username", ""),
                "energy": settings.ENERGY_DEFAULT,
                "max_energy": settings.MAX_ENERGY_DEFAULT,
            },
        )

        # Only set referrer if not already set
        if profile.referred_by is None:
            profile.referred_by = referrer
            profile.save(update_fields=["referred_by"])
            logger.info(f"✅ Referral saved: {telegram_id} -> {referrer.telegram_id}")
            return JsonResponse({"success": True, "message": "Referral registered"})
        else:
            logger.info(f"ℹ️ User {telegram_id} already has a referrer")
            return JsonResponse({"success": True, "message": "Referral already registered"})

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        logger.error(f"Bot API error: {e}")
        return JsonResponse({"error": "Internal server error"}, status=500)
