# Purex Protocol Telegram Bot

## 🚀 Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create `.env` file:
```bash
cp .env.example .env
# Edit .env with your bot token
```

3. Run the bot:
```bash
python bot.py
```

## 📋 Commands

- `/start` - Welcome message and referral registration
- `/start r_CODE` - Register referral code
- `/help` - Show help message
- `/menu` - Remind about Mini App

## 🔗 Referral System

The bot handles referral registration when users click referral links:

1. User clicks: `https://t.me/purexprotocol_bot?startapp=r_CODE`
2. Telegram opens chat with bot
3. User clicks "Start" → bot receives `/start r_CODE`
4. Bot calls backend API to store referral
5. User opens Mini App → referral is applied after verification

## 🛠️ Development

The bot communicates with the backend API:
- `POST /api/v1/auth/bot/start/` - Store pending referral
- Referrals are stored in Redis for 24 hours
- Applied after user verification in Mini App
