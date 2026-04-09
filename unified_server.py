#!/usr/bin/env python3
"""
Unified server for Mini App and webhook
"""
import os
import json
import logging
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory
import requests

load_dotenv('/Users/hoodmission/Desktop/Phoenix Protocol/bot/.env')

app = Flask(__name__)
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
BACKEND_URL = 'http://localhost:8002/api/v1/auth/bot/start/'

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Serve Mini App
@app.route('/')
def serve_mini_app():
    return send_from_directory('/Users/hoodmission/Desktop/Phoenix Protocol/Front/Phoenix-Protocol/dist', 'index.html')

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    return send_from_directory('/Users/hoodmission/Desktop/Phoenix Protocol/Front/Phoenix-Protocol/dist/assets', filename)

# Webhook handler
@app.route('/webhook', methods=['POST'])
def webhook():
    """Handle Telegram webhook"""
    data = request.get_json()
    logger.info(f"📨 Received update: {data}")
    
    if 'message' in data:
        message = data['message']
        text = message.get('text', '')
        chat_id = message['chat']['id']
        user = message.get('from', {})
        user_id = user.get('id')
        first_name = user.get('first_name', 'User')
        
        if text.startswith('/start'):
            parts = text.split()
            if len(parts) > 1 and parts[1].startswith('r_'):
                referral_code = parts[1][2:]  # Remove 'r_' prefix
                logger.info(f"🔗 Referral from user {user_id}: {referral_code}")
                
                try:
                    response = requests.post(
                        BACKEND_URL,
                        json={
                            'telegram_id': user_id,
                            'referral_code': referral_code,
                            'bot_token': BOT_TOKEN
                        },
                        timeout=10
                    )
                    
                    if response.status_code == 200 and response.json().get('success'):
                        logger.info(f"✅ Referral {referral_code} saved for user {user_id}")
                        send_message(chat_id, f"🎉 Welcome to Purex Protocol, {first_name}!\n\n✅ Your referral has been registered.\n\n📱 Tap the menu button to start mining!")
                    else:
                        logger.warning(f"❌ Referral failed: {response.text}")
                        send_message(chat_id, f"👋 Welcome to Purex Protocol, {first_name}!\n\n⚠️ Invalid referral link.\n\n📱 Tap the menu button to start mining!")
                        
                except Exception as e:
                    logger.error(f"❌ Error: {e}")
                    send_message(chat_id, f"👋 Welcome to Purex Protocol, {first_name}!\n\n📱 Tap the menu button to start mining!")
            else:
                logger.info(f"👋 Regular /start from user {user_id}")
                send_message(chat_id, f"👋 Welcome to Purex Protocol, {first_name}!\n\n📱 Tap the menu button to start mining!")
    
    return jsonify({'status': 'ok'})

def send_message(chat_id, text):
    """Send message via Telegram API"""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    try:
        requests.post(url, json={'chat_id': chat_id, 'text': text}, timeout=10)
    except Exception as e:
        logger.error(f"Failed to send message: {e}")

if __name__ == '__main__':
    logger.info("🚀 Starting unified server...")
    app.run(port=3001, debug=True)
