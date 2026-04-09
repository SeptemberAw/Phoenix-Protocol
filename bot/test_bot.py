#!/usr/bin/env python3
import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
BACKEND_URL = 'http://localhost:8001/api/v1/auth/bot/start/'

def test_referral_api():
    """Test the referral API directly"""
    print("🧪 Testing referral API...")
    
    # Test data
    test_data = {
        'telegram_id': 999999999,
        'referral_code': '60ea2a7c4c16',
        'bot_token': BOT_TOKEN
    }
    
    try:
        response = requests.post(BACKEND_URL, json=test_data, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ API Test Success: {result}")
        else:
            print(f"❌ API Test Failed: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"❌ API Test Error: {e}")

def check_pending_referral():
    """Check if referral is stored"""
    print("🔍 Checking pending referral...")
    
    try:
        # Import and check
        import sys
        sys.path.append('/Users/hoodmission/Desktop/Phoenix Protocol/Backend')
        from accounts.services import get_pending_referral
        
        pending = get_pending_referral(999999999)
        print(f"📋 Pending referral: {pending}")
        
    except Exception as e:
        print(f"❌ Check Error: {e}")

if __name__ == '__main__':
    print("🚀 Purex Protocol Bot Test")
    print(f"🔑 Bot Token: {BOT_TOKEN[:20]}..." if BOT_TOKEN else "❌ No token")
    print(f"🌐 Backend URL: {BACKEND_URL}")
    print()
    
    test_referral_api()
    print()
    check_pending_referral()
