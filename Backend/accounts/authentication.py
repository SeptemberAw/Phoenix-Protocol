import json
import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from core.utils import check_replay, validate_telegram_init_data

from .models import UserProfile

User = get_user_model()
logger = logging.getLogger(__name__)

DEV_MOCK_INIT_DATA = (
    'query_id=AAHtest&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Test%22'
    '%2C%22last_name%22%3A%22User%22%2C%22username%22%3A%22testuser%22%2C%22language_code%22%3A%22en%22%7D'
    '&auth_date=1234567890&hash=mockhash'
)


class TelegramAuthSerializer(serializers.Serializer):
    init_data = serializers.CharField()
    referral_code = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_init_data(self, value):
        logger.info(f"🔍 Received init_data: {value[:100]}...")
        
        # Only allow real Telegram authentication
        bot_token = settings.TELEGRAM_BOT_TOKEN
        if not bot_token:
            raise serializers.ValidationError("Bot token not configured.")

        try:
            parsed = validate_telegram_init_data(value, bot_token)
            if parsed is None:
                raise serializers.ValidationError("Invalid Telegram init data.")
        except Exception as e:
            logger.error(f"🔴 Validation error: {e}")
            raise serializers.ValidationError("Invalid Telegram init data.")

        if check_replay(parsed.get("hash", "")):
            raise serializers.ValidationError("Replay detected.")

        logger.info("✅ Telegram data validated successfully")
        return parsed

    def create(self, validated_data):
        parsed = validated_data["init_data"]
        referral_code = validated_data.get("referral_code", "")

        logger.info(f"🔗 Processing auth with referral_code: '{referral_code}'")

        user_data = json.loads(parsed.get("user", "{}"))
        telegram_id = user_data.get("id")
        first_name = user_data.get("first_name", "")
        last_name = user_data.get("last_name", "")

        # Display name: always first_name (+ last_name if present)
        display_name = first_name
        if last_name and first_name:
            display_name = f"{first_name} {last_name}"

        if not telegram_id:
            raise serializers.ValidationError("No telegram user id in init_data.")

        user, created = User.objects.get_or_create(
            username=str(telegram_id),
            defaults={"first_name": first_name},
        )

        profile, profile_created = UserProfile.objects.get_or_create(
            user=user,
            defaults={
                "telegram_id": telegram_id,
                "telegram_username": display_name,
                "energy": settings.ENERGY_DEFAULT,
                "max_energy": settings.MAX_ENERGY_DEFAULT,
            },
        )

        # Set referral for any user without a referrer (new or existing)
        if referral_code and not profile.referred_by:
            logger.info(f"🔗 User {telegram_id} with referral code: {referral_code}")
            try:
                referrer = UserProfile.objects.get(referral_code=referral_code)
                if referrer.telegram_id != telegram_id:
                    profile.referred_by = referrer
                    profile.save(update_fields=["referred_by"])
                    logger.info(f"✅ Referral linked: {telegram_id} -> {referrer.telegram_id}")
                else:
                    logger.info(f"❌ Self-referral blocked for {telegram_id}")
            except UserProfile.DoesNotExist:
                logger.warning(f"❌ Invalid referral code: {referral_code}")
        elif referral_code and profile.referred_by:
            logger.info(f"ℹ️ User {telegram_id} already has referrer, ignoring code: {referral_code}")

        # Update display name only if it was empty (webhook-created users)
        if not profile_created and display_name and not profile.telegram_username:
            profile.telegram_username = display_name
            profile.save(update_fields=["telegram_username"])

        refresh = RefreshToken.for_user(user)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "is_new": created,
        }
