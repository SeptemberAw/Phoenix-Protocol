import redis
import json
from datetime import datetime, timedelta
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

def get_redis_client():
    """Get Redis client for referral storage"""
    try:
        import redis
        return redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            decode_responses=True
        )
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")
        return None

def store_pending_referral(telegram_id: int, referral_code: str) -> bool:
    """
    Store pending referral when user clicks /start with referral link
    Returns True if stored successfully
    """
    redis_client = get_redis_client()
    if not redis_client:
        logger.error("Cannot store referral - Redis not available")
        return False
    
    try:
        # Find referrer by referral code
        from accounts.models import UserProfile
        try:
            referrer = UserProfile.objects.get(referral_code=referral_code)
        except UserProfile.DoesNotExist:
            logger.warning(f"Invalid referral code: {referral_code}")
            return False
        
        # Store pending referral with 24h expiry
        key = f"pending_referral:{telegram_id}"
        data = {
            "referrer_id": referrer.telegram_id,
            "referral_code": referral_code,
            "timestamp": datetime.now().isoformat()
        }
        
        redis_client.setex(key, 86400, json.dumps(data))  # 24 hours
        logger.info(f"🔗 Stored pending referral: {telegram_id} -> {referrer.telegram_id}")
        return True
        
    except Exception as e:
        logger.error(f"Error storing pending referral: {e}")
        return False

def get_pending_referral(telegram_id: int) -> dict:
    """
    Get pending referral for telegram_id
    Returns dict with referrer_id or None
    """
    redis_client = get_redis_client()
    if not redis_client:
        return None
    
    try:
        key = f"pending_referral:{telegram_id}"
        data = redis_client.get(key)
        
        if data:
            return json.loads(data)
        return None
        
    except Exception as e:
        logger.error(f"Error getting pending referral: {e}")
        return None

def consume_pending_referral(telegram_id: int) -> bool:
    """
    Remove pending referral after it's been applied
    Returns True if removed successfully
    """
    redis_client = get_redis_client()
    if not redis_client:
        return False
    
    try:
        key = f"pending_referral:{telegram_id}"
        result = redis_client.delete(key)
        logger.info(f"🗑️ Consumed pending referral for {telegram_id}: {result > 0}")
        return result > 0
        
    except Exception as e:
        logger.error(f"Error consuming pending referral: {e}")
        return False

def apply_referral_after_verification(user_telegram_id: int) -> bool:
    """
    Apply referral after user verification
    This should be called when user gets verified
    """
    try:
        from accounts.models import UserProfile
        
        # Get pending referral
        pending = get_pending_referral(user_telegram_id)
        if not pending:
            return False
        
        referrer_id = pending["referrer_id"]
        
        # Don't apply if user already has a referrer
        user_profile = UserProfile.objects.get(telegram_id=user_telegram_id)
        if user_profile.referred_by:
            logger.info(f"User {user_telegram_id} already has referrer")
            consume_pending_referral(user_telegram_id)
            return False
        
        # Apply referral
        referrer_profile = UserProfile.objects.get(telegram_id=referrer_id)
        user_profile.referred_by = referrer_profile
        user_profile.save(update_fields=["referred_by"])
        
        # Remove pending referral
        consume_pending_referral(user_telegram_id)
        
        logger.info(f"✅ Applied referral after verification: {user_telegram_id} -> {referrer_id}")
        return True
        
    except UserProfile.DoesNotExist:
        logger.error(f"User profile not found: {user_telegram_id}")
        return False
    except Exception as e:
        logger.error(f"Error applying referral after verification: {e}")
        return False
