#!/usr/bin/env python3
import asyncio
import logging
import os
import requests
from dotenv import load_dotenv
from telegram import Update, Bot
from telegram.ext import Application, CommandHandler, ContextTypes

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

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command with referral support"""
    user = update.effective_user
    user_id = user.id
    
    logger.info(f"🎯 Start command from user {user_id} with args: {context.args}")
    
    # Check if there's a referral code
    if context.args and len(context.args) > 0:
        arg = context.args[0]
        
        if arg.startswith('r_'):
            referral_code = arg[2:]  # Remove 'r_' prefix
            logger.info(f"🔗 Referral code detected: {referral_code}")
            
            # Send referral to backend
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
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get('success'):
                        await update.message.reply_text(
                            f"🎉 *Referral registered successfully!*\n\n"
                            f"Welcome to Purex Protocol, {user.first_name}!\n\n"
                            f"📱 Open the Mini App through the menu button to start mining.\n"
                            f"🔗 Your referral link will be available in the Hub tab.\n\n"
                            f"💰 After verification, your referrer will receive rewards from your mining!"
                        )
                        logger.info(f"✅ Referral {referral_code} registered for user {user_id}")
                    else:
                        await update.message.reply_text(
                            f"❌ *Invalid referral link*\n\n"
                            f"The referral code `{referral_code}` is not valid.\n"
                            f"Please check the link and try again."
                        )
                        logger.warning(f"❌ Invalid referral code: {referral_code}")
                else:
                    await update.message.reply_text(
                        "❌ *Server error*\n\n"
                        "Please try again in a moment."
                    )
                    logger.error(f"❌ Backend error: {response.status_code}")
                    
            except requests.RequestException as e:
                await update.message.reply_text(
                    "❌ *Connection error*\n\n"
                    "Please try again in a moment."
                )
                logger.error(f"❌ Request error: {e}")
        else:
            # Regular /start without referral
            await update.message.reply_text(
                f"👋 *Welcome to Purex Protocol!*\n\n"
                f"Hello {user.first_name}!\n\n"
                f"📱 Open the Mini App through the menu button to start mining PUREX tokens.\n\n"
                f"🚀 Want to earn more? Share your referral link from the Hub tab!"
            )
            logger.info(f"👋 Regular start from user {user_id}")
    else:
        # No arguments - regular welcome
        await update.message.reply_text(
            f"👋 *Welcome to Purex Protocol!*\n\n"
            f"Hello {user.first_name}!\n\n"
            f"📱 Open the Mini App through the menu button to start mining PUREX tokens.\n\n"
            f"🚀 Want to earn more? Share your referral link from the Hub tab!"
        )
        logger.info(f"👋 Regular start from user {user_id}")

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show help message"""
    await update.message.reply_text(
        "🤖 *Purex Protocol Bot Help*\n\n"
        "📱 *Mini App*: Use the menu button to open the mining app\n"
        "🔗 *Referrals*: Share your link from the Hub tab in Mini App\n"
        "💰 *Mining*: Earn PUREX tokens with your device\n"
        "🎯 *Verification*: Unlock premium features\n\n"
        "❓ Need help? Check the Mini App!"
    )

async def menu_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /menu command"""
    await update.message.reply_text(
        "📱 *Open Mini App*\n\n"
        "Click the menu button below or use the main menu to launch Purex Protocol Mini App!"
    )

def main() -> None:
    """Start the bot"""
    if not BOT_TOKEN:
        logger.error("❌ No BOT_TOKEN provided!")
        return
    
    logger.info("🚀 Starting Purex Protocol Main Bot...")
    
    # Create the Application
    application = Application.builder().token(BOT_TOKEN).build()
    
    # Add command handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("menu", menu_command))
    
    # Start the bot
    logger.info("✅ Bot is ready to receive commands...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()
