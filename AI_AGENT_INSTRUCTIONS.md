# Purex Protocol — AI Agent Instructions

> **Last updated:** 2026-03-01
> **Purpose:** This file is the single source of truth for any AI agent working on this project.
> **Rule #1:** Read this file ENTIRELY before making any changes.

---

## 1. Project Overview

**Purex Protocol** (formerly CashinHash) — Telegram Mini App idle PvP game.
- Bot: `@purexprotocol_bot`
- Token name: **PUREX**
- TG Channel: `@purexprotocol`

### Repos / Folders
```
Phoenix Protocol/
├── Backend/          # Django REST API (Python 3.12, Django 5.1)
├── Front/
│   └── Phoenix-Protocol/   # React + Vite + TailwindCSS
├── AI_AGENT_INSTRUCTIONS.md  # ← THIS FILE
└── *.md              # Legacy planning docs (may be outdated)
```

---

## 2. Tech Stack

### Backend
- **Python 3.12** / **Django 5.1** / **Django REST Framework** / **SimpleJWT**
- **PostgreSQL** — DB name: `purex_protocol`
- **Redis** — leaderboard (ZSET), replay protection, idempotency, pending referrals
- **Celery + Celery Beat** — aggressor decay, daily fight reset, season end
- **Docker Compose** — production orchestration

### Frontend
- **React 18** + **TypeScript** + **Vite**
- **TailwindCSS** — styling
- **Lucide React** — icons
- **Telegram Mini App SDK** — `window.Telegram.WebApp`

### Development
- Frontend dev server: **port 3000** (Vite)
- Backend dev server: **port 8001** (`python manage.py runserver 0.0.0.0:8001`)
- Ngrok tunnel: points to **port 3000** (frontend), Vite proxies `/api/` to backend
- Ngrok URL (may change): check current ngrok process or `.env`

---

## 3. Backend Structure

```
Backend/
├── config/           # settings.py, urls.py, celery.py, wsgi/asgi
├── core/             # middleware, permissions, throttling, utils (HMAC, replay)
├── accounts/         # UserProfile, BotProfile (proxy), Telegram auth, JWT, referrals
├── game/             # Mining, upgrades, ascension, leaderboard, network tiers
├── pvp/              # PvP system: search, resolve, aggressor balance, bots, admin attack
├── economy/          # TransactionHistory, quests, referral bonuses
├── payments/         # Telegram Stars / TON payments, webhooks
├── season/           # Season lifecycle, history, Celery tasks
├── templates/admin/  # Custom admin templates (pvp, accounts)
├── requirements.txt
└── manage.py
```

### Key Models

#### `accounts.UserProfile`
| Field | Type | Notes |
|-------|------|-------|
| `telegram_id` | BigInteger | **Unique**, primary identifier from Telegram |
| `telegram_username` | CharField | Display name (first_name preferred, NOT @handle) |
| `balance` / `season_balance` / `lifetime_balance` | Decimal(20,4) | All math uses Decimal |
| `energy` / `max_energy` | Integer | Regen: 5/sec |
| `generation` | Integer | Ascension level (starts at 1) |
| `aggressor_level` | Float | 0-100, controls PvP visibility |
| `fights_left` | Integer | Daily limit (default 5) |
| `is_verified` | Boolean | Required for mining and PvP |
| `is_bot` | Boolean | Bot opponent flag |
| `is_banned` / `is_shadow_banned` | Boolean | Ban system |
| `referral_code` | CharField | Auto-generated UUID hex[:12] |
| `referred_by` | FK self | Referral parent |
| `network_tier` | CharField | Neural Link / Satellite Grid / Quantum Mesh / Singularity |

#### `accounts.BotProfile` (proxy model)
- Same table as UserProfile, filtered by `is_bot=True`
- Separate admin panel listing under "Bots"
- Generated via `python manage.py generate_bots` or admin button

#### `pvp.PvPConfig` (singleton)
| Field | Default | Notes |
|-------|---------|-------|
| `win_chance` | 0.5 | 50/50 roulette |
| `win_multiplier` | 1.3 | Capped at 1.3x |
| `tax_percent` | 10.0 | Burned from wager |
| `cooldown_same_opponent_minutes` | 30 | |
| `aggressor_increase_per_fight` | 15.0 | |
| `daily_fight_limit` | 5 | |

#### `pvp.PvPMatch`
- `attacker` / `defender` FK → UserProfile
- `wager`, `result` (win/loss), `attacker_delta`, `defender_delta`, `tax_burned`

#### `economy.TransactionHistory`
- TX types: `mining`, `upgrade`, `ascend`, `pvp_attack`, `pvp_defend`, `quest_reward`, `referral_bonus`, `payment`, `season_reset`, `admin_adjust`, `admin_give`, `admin_take`

---

## 4. API Endpoints

All prefixed with `/api/v1/`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/telegram/` | No | Authenticate via TG initData → JWT |
| GET | `/auth/init/` | Yes | Full state "god object" for app boot |
| POST | `/mining/start/` | Yes+Verified | Start mining |
| POST | `/mining/stop/` | Yes | Stop + harvest |
| POST | `/mining/harvest/` | Yes | Harvest without stopping |
| POST | `/upgrade/buy/` | Yes | Buy upgrade level |
| POST | `/ascend/` | Yes | Ascend to next generation |
| POST | `/pvp/search/` | Yes | Find matchmade opponent |
| POST | `/pvp/resolve/` | Yes | Execute PvP (server RNG) |
| GET | `/economy/transactions/` | Yes | Transaction history |
| POST | `/economy/quest/claim/` | Yes | Claim quest reward |
| GET | `/economy/referrals/` | Yes | Referral list + code |
| POST | `/payments/verify/` | Yes | Verify payment |
| POST | `/payments/webhook/telegram/` | No | Telegram payment webhook |
| GET | `/leaderboard/` | Yes | Redis ZSET leaderboard |
| GET | `/season/active/` | Yes | Current season |

---

## 5. PvP System — CRITICAL LOGIC

### How it works
1. Player taps "INJECT BREACH" → frontend calls `POST /pvp/search/`
2. Backend `find_opponent()` finds opponent by aggressor_level + balance range (50%-200%)
3. If no real opponent → falls back to **bot opponents** (`is_bot=True`)
4. Frontend displays VS screen → calls `POST /pvp/resolve/` with `opponent_id` (telegram_id!) and `wager`
5. Backend resolves 50/50 RNG, applies balance changes, returns result
6. Frontend plays animation based on server result

### ⚠️ IMPORTANT: `resolve_pvp()` uses `telegram_id` NOT `pk`
```python
defender = UserProfile.objects.get(telegram_id=defender_id)  # NOT pk!
```

### Aggressor Level Balancing
| Event | Change |
|-------|--------|
| Player attacks someone | +15 to attacker |
| Attacker wins (defender robbed) | -25 from defender |
| Attacker loses (defender defended) | -10 from defender |

### Anti-Grief Protections
- **Attack immunity**: 10 min cooldown after being attacked
- **Attack cap**: Max attacks received per day = (attacks_initiated × 1.5) + 1
- **Same-opponent cooldown**: 30 min (configurable)
- **Verification required**: Must be verified to fight (bots exempt)
- **Shadow ban**: Always loses PvP, no visible restriction
- **Balance range**: Only opponents with 50%-200% of your balance

### Bot Opponents
- `is_bot=True` on UserProfile
- Skip aggressor check, verification check, harvest_mining
- Aggressor level doesn't change when bot is attacked
- Generate: `python manage.py generate_bots --count 50 --min-balance 50000 --max-balance 100000000`
- Or via admin panel: Accounts → Bots → "🤖 Generate Bots" button
- Can also load from file: `--from-file bot_ids.txt` (one telegram_id per line)
- Clear all: `--clear`

### Admin Attack
- Admin panel: PvP → PvP Matches → "⚔️ Admin Attack" button
- Deducts balance, logs as `pvp_defend` transaction
- Validates amount against player balance

---

## 6. Admin Panel Features

### Accounts → User Profiles (real players only, `is_bot=False`)
- Each user page has **"💰 Give/Take Cash"** button
- Give: adds to balance + season_balance, logs `admin_give` tx
- Take: deducts from balance + season_balance, logs `admin_take` tx
- This is DIFFERENT from editing balance directly (this creates a transaction record)

### Accounts → Bots (`is_bot=True` only)
- **"🤖 Generate Bots"** button — creates bots with random stats
- Separate list from real players

### PvP → PvP Matches
- **"⚔️ Admin Attack"** button — raid a specific player by telegram_id

### PvP → PvP Configuration
- Singleton config for win chance, multiplier, tax, cooldowns, etc.

---

## 7. Authentication Flow

### Telegram Auth (`/api/v1/auth/telegram/`)
1. Frontend sends `init_data` (from `window.Telegram.WebApp.initData`) + optional `referral_code`
2. Backend validates HMAC signature against `TELEGRAM_BOT_TOKEN`
3. Checks replay via Redis
4. Extracts user data from init_data JSON
5. Creates/gets Django User + UserProfile
6. **Display name logic**: `first_name` > `@username` > `telegram_id`
   - If user has `first_name` + `last_name` → combines them
   - Updates `telegram_username` on EVERY login (catches empty names from webhook)
7. Links referral if `referral_code` provided and no existing referrer
8. Returns JWT `access` + `refresh` tokens

### Bot Webhook (`/api/v1/accounts/bot-start/`)
- Called when user sends `/start r_CODE` to the bot
- Creates user with potentially empty username (hasn't opened Mini App yet)
- Sets `referred_by` immediately
- Username gets filled on first Mini App login (see auth flow above)

### Referral Deep Link Format
- Bot link: `https://t.me/purexprotocol_bot?start=r_{referral_code}`
- Mini App link: `https://t.me/purexprotocol_bot/app?startapp=r_{referral_code}`

---

## 8. Frontend Architecture

### Key Files
| File | Purpose |
|------|---------|
| `App.tsx` | Root component, state management, periodic harvest (10s) |
| `hooks/useAuth.ts` | TG auth → JWT → fetchInit |
| `hooks/useGameActions.ts` | API wrappers (mining, upgrades, PvP, etc.) |
| `api.ts` | Fetch client, JWT management, auto-refresh, idempotency |
| `telegram.d.ts` | TG WebApp type declarations |
| `vite.config.ts` | Proxy `/api/` → `localhost:8001` |

### Tabs
| Component | Description |
|-----------|-------------|
| `FightsTab.tsx` | PvP interface — wager, search, battle animation |
| `TopTab.tsx` | Leaderboard from `/api/v1/leaderboard/` |
| `HubTab.tsx` | Referrals from `/api/v1/economy/referrals/` |
| `EarnTab.tsx` | Quests (props from App) |
| `ShopModal.tsx` | Upgrade shop |

### Critical Frontend Details
- **Mining animation is cosmetic only** — server overwrites on harvest
- **PvP resolve happens BEFORE animation** — result is known, animation plays accordingly
- All mutating POSTs send `idempotency_key`
- `FightsTab` sends `telegram_id` as `opponent_id` to resolve endpoint
- Fights unlock at **generation >= 3**

---

## 9. Game Mechanics

### Mining
- Server-authoritative, real-time calculation on harvest
- Power: `(0.005 + core_bonus) × gen_mult × net_mult × league_mult`
- Energy cost: `ENERGY_COST_RATIO = 200`
- Energy regen: `ENERGY_REGEN_PER_SEC = 5`
- Max energy default: `6000`
- Requires `is_verified = True`

### Upgrades (seeded via `manage.py seed_game_data`)
- `u1` — Mining Core (mining power)
- `u2` — Neural Amplifier (energy efficiency)
- `u3` — Shield Matrix (defense)
- `u4` — Auto-Sync Bot (passive income)

### Ascension (Generations)
- Resets upgrades, multiplies mining power
- Gen multiplier: `5^(generation - 1)`

### Leagues (balance-based)
| League | Min Balance | Mining Mult |
|--------|------------|-------------|
| Master | 1B | 3.0x |
| Diamond | 500M | 2.0x |
| Platinum | 100M | 1.5x |
| Gold | 10M | 1.25x |
| Silver | 1M | 1.1x |
| Bronze | 0 | 1.0x |

### Network Tiers
| Tier | Multiplier |
|------|-----------|
| Neural Link | 1.0x |
| Satellite Grid | 1.5x |
| Quantum Mesh | 2.0x |
| Singularity | 4.0x |

---

## 10. Security

- **HMAC** validation on Telegram initData
- **Redis replay protection** (prevents init_data reuse)
- **Idempotency keys** on upgrade, PvP, mining stop
- **Rate limiting**: 60/min burst, 600/hour sustained
- **`select_for_update()` + `transaction.atomic()`** on ALL critical balance paths
- **Shadow ban**: PvP always loses, no visible restriction
- **Ban system**: with optional expiry (`ban_until`)
- **All balance math**: `Decimal` — NO floating point

---

## 11. Environment Variables

Key env vars (see `.env` or `.env.example`):
```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=purexprotocol_bot
SECRET_KEY=...
DATABASE_URL=postgres://...
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
ENERGY_DEFAULT=6000
MAX_ENERGY_DEFAULT=6000
ENERGY_REGEN_PER_SEC=5
ENERGY_COST_RATIO=200
REFERRAL_BONUS_PERCENT=0.10
```

---

## 12. Management Commands

```bash
python manage.py seed_game_data       # Seed upgrades, quests, network tiers, PvP config
python manage.py setup_celery_beat    # Configure periodic Celery Beat tasks
python manage.py generate_bots        # Generate bot opponents for PvP
  --count 50                          # Number of bots
  --min-balance 50000                 # Min balance
  --max-balance 100000000             # Max balance
  --from-file bot_ids.txt             # Load telegram IDs from file
  --clear                             # Delete all bots
```

---

## 13. ⚠️ DO NOT

1. **DO NOT** use `pk` to look up opponents in PvP — always use `telegram_id`
2. **DO NOT** use `float` for balance math — always `Decimal`
3. **DO NOT** remove idempotency checks on mutating endpoints
4. **DO NOT** hardcode API keys — always use env vars
5. **DO NOT** skip `select_for_update()` on balance changes
6. **DO NOT** remove `transaction.atomic()` from critical paths
7. **DO NOT** trust frontend-sent win/loss results — server determines outcome
8. **DO NOT** edit `constants.ts` — it's a legacy file, no longer imported
9. **DO NOT** change the proxy port in `vite.config.ts` without checking which port the backend runs on
10. **DO NOT** mix up `telegram_username` (display name) with Telegram `@handle` — we store display name (first_name preferred)

---

## 14. Current Status & Known Issues

### ✅ Working
- Telegram Mini App auth + JWT
- Mining (start/stop/harvest) — server authoritative
- Upgrades + ascension
- PvP search + resolve (50/50 roulette)
- Bot opponents as fallback
- Aggressor level balancing
- Referral system (webhook + Mini App)
- Leaderboard (Redis ZSET with DB fallback)
- Admin panel: give/take cash, admin attack, bot generation
- Username auto-update on login

### 🔧 TODO / In Progress
- **Payments**: Stars + TON integration (partially implemented, needs testing)
- **Notifications**: Telegram bot notifications when player is raided (admin_attack creates tx but doesn't send TG message yet)
- **Bot TG accounts**: User will prepare real TG accounts for bots (avatars, #PurexProtocol in name) — `generate_bots --from-file` ready for this
- **Celery tasks**: Aggressor decay, daily fight reset, season end — defined but need Celery/Redis in dev
- **Frontend PvP polish**: Payment/recharge flow in FightsTab needs backend connection

---

## 15. Running Locally

```bash
# Terminal 1: Backend
cd Backend
python3 manage.py runserver 0.0.0.0:8001

# Terminal 2: Frontend
cd Front/Phoenix-Protocol
npm run dev    # starts on port 3000

# Terminal 3: Ngrok (for Telegram Mini App)
ngrok http 3000
# Then set the Mini App URL in BotFather to the ngrok URL

# Admin panel
open http://localhost:8001/admin/
```
