#!/usr/bin/env python3
import logging
import os
import requests
from dotenv import load_dotenv
import subprocess
import sys

# Load environment variables
load_dotenv()

# Enable logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Bot configuration
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
BACKEND_URL = 'http://localhost:8001/api/v1/auth/bot/start/'

def test_bot_connection():
    """Test if bot token is valid"""
    try:
        response = requests.get(f"https://api.telegram.org/bot{BOT_TOKEN}/getMe")
        if response.status_code == 200:
            bot_info = response.json()
            logger.info(f"✅ Bot connected: {bot_info['result']['username']}")
            return True
        else:
            logger.error(f"❌ Bot connection failed: {response.text}")
            return False
    except Exception as e:
        logger.error(f"❌ Bot connection error: {e}")
        return False

def manual_test_referral():
    """Manual test for referral system"""
    print("🧪 Manual referral test...")
    
    # Simulate bot processing /start r_60ea2a7c4c16
    test_data = {
        'telegram_id': 777777777,
        'referral_code': '60ea2a7c4c16',
        'bot_token': BOT_TOKEN
    }
    
    try:
        response = requests.post(BACKEND_URL, json=test_data, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Referral API test: {result}")
            
            # Check if stored
            import sys
            sys.path.append('/Users/hoodmission/Desktop/Phoenix Protocol/Backend')
            os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
            
            import django
            django.setup()
            
            from accounts.services import get_pending_referral
            pending = get_pending_referral(777777777)
            print(f"📋 Pending referral: {pending}")
            
        else:
            print(f"❌ Referral API failed: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"❌ Referral test error: {e}")

if __name__ == '__main__':
    print("🚀 Purex Protocol Bot Test")
    print(f"🔑 Bot Token: {BOT_TOKEN[:20]}..." if BOT_TOKEN else "❌ No token")
    
    if test_bot_connection():
        print("\n🧪 Testing referral system...")
        manual_test_referral()
    else:
        print("❌ Fix bot token first")
