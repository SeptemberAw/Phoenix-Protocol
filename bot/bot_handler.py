#!/usr/bin/env python3
"""
Purex Protocol Bot Handler
Works alongside the Mini App on the same @purexprotocol_bot token.
Handles /start commands with referral codes.
"""
import asyncio
import logging
import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8001")
API_URL = f"{BACKEND_URL}/api/v1/auth/bot/start/"


async def handle_update(update: dict) -> None:
    """Process a single Telegram update."""
    message = update.get("message")
    if not message:
        return

    text = message.get("text", "")
    chat_id = message["chat"]["id"]
    user = message.get("from", {})
    user_id = user.get("id")
    first_name = user.get("first_name", "User")

    if not text.startswith("/"):
        return

    parts = text.split()
    command = parts[0].lower().replace(f"@{os.getenv('TELEGRAM_BOT_USERNAME', 'purexprotocol_bot')}", "")

    if command == "/start":
        await handle_start(chat_id, user_id, first_name, parts[1:])
    elif command == "/help":
        await handle_help(chat_id)
    else:
        pass  # Ignore unknown commands


async def handle_start(chat_id: int, user_id: int, first_name: str, args: list) -> None:
    """Handle /start with optional referral code."""
    if args and args[0].startswith("r_"):
        referral_code = args[0][2:]
        logger.info(f"🔗 Referral from user {user_id}: code={referral_code}")

        try:
            resp = requests.post(
                API_URL,
                json={
                    "telegram_id": user_id,
                    "referral_code": referral_code,
                    "bot_token": BOT_TOKEN,
                },
                timeout=10,
            )

            if resp.status_code == 200 and resp.json().get("success"):
                logger.info(f"✅ Referral {referral_code} saved for user {user_id}")
                await send_message(
                    chat_id,
                    f"🎉 Welcome to Purex Protocol, {first_name}!\n\n"
                    f"✅ Your referral has been registered.\n\n"
                    f"📱 Tap the menu button below to open the app and start mining PUREX tokens!",
                )
            else:
                detail = resp.json().get("message", "Unknown error")
                logger.warning(f"❌ Referral failed for {user_id}: {detail}")
                await send_message(
                    chat_id,
                    f"👋 Welcome to Purex Protocol, {first_name}!\n\n"
                    f"⚠️ Referral link is invalid or expired.\n\n"
                    f"📱 Tap the menu button below to open the app and start mining!",
                )
        except requests.RequestException as e:
            logger.error(f"❌ API error: {e}")
            await send_message(
                chat_id,
                f"👋 Welcome to Purex Protocol, {first_name}!\n\n"
                f"📱 Tap the menu button below to open the app and start mining!",
            )
    else:
        logger.info(f"👋 Regular /start from user {user_id}")
        await send_message(
            chat_id,
            f"👋 Welcome to Purex Protocol, {first_name}!\n\n"
            f"📱 Tap the menu button below to open the app and start mining PUREX tokens.\n\n"
            f"🚀 Invite friends from the Hub tab to earn referral rewards!",
        )


async def handle_help(chat_id: int) -> None:
    """Handle /help command."""
    await send_message(
        chat_id,
        "🤖 Purex Protocol\n\n"
        "📱 Menu Button — open the mining app\n"
        "🔗 Referrals — share your link from the Hub tab\n"
        "💰 Mining — earn PUREX tokens\n"
        "🎯 Verification — unlock full features\n\n"
        "Tap the menu button to get started!",
    )


async def send_message(chat_id: int, text: str) -> None:
    """Send a message via Telegram Bot API."""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    try:
        requests.post(url, json={"chat_id": chat_id, "text": text}, timeout=10)
    except requests.RequestException as e:
        logger.error(f"Failed to send message: {e}")


async def poll() -> None:
    """Long-polling loop."""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates"
    offset = 0

    # Verify bot token
    me = requests.get(f"https://api.telegram.org/bot{BOT_TOKEN}/getMe", timeout=10)
    if me.status_code != 200:
        logger.error("❌ Invalid bot token!")
        return
    bot_info = me.json().get("result", {})
    logger.info(f"✅ Connected as @{bot_info.get('username')}")

    while True:
        try:
            resp = requests.get(
                url, params={"offset": offset, "timeout": 30}, timeout=35
            )
            if resp.status_code != 200:
                logger.error(f"Polling error: {resp.status_code}")
                await asyncio.sleep(5)
                continue

            data = resp.json()
            for update in data.get("result", []):
                offset = update["update_id"] + 1
                try:
                    await handle_update(update)
                except Exception as e:
                    logger.error(f"Error handling update: {e}")

        except requests.RequestException as e:
            logger.error(f"Polling connection error: {e}")
            await asyncio.sleep(5)


def main():
    if not BOT_TOKEN:
        logger.error("❌ Set TELEGRAM_BOT_TOKEN in .env")
        return
    logger.info("🚀 Starting Purex Protocol bot handler...")
    asyncio.run(poll())


if __name__ == "__main__":
    main()
