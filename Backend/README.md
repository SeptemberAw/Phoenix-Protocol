# CashinHash Backend

Production-ready Django backend for the CashinHash Telegram WebApp idle PvP game.

## Tech Stack

- **Python 3.12** / **Django 5.1**
- **Django REST Framework** + **SimpleJWT**
- **PostgreSQL** — primary database
- **Redis** — caching, leaderboards (ZSET), replay protection, idempotency
- **Celery** + **Celery Beat** — background tasks (aggressor decay, daily fight reset, season end)
- **Docker Compose** — full orchestration

## Quick Start

```bash
# 1. Copy env
cp .env.example .env

# 2. Start everything
docker compose up --build -d

# 3. Create superuser
docker compose exec django python manage.py createsuperuser

# 4. Setup Celery Beat schedules
docker compose exec django python manage.py setup_celery_beat
```

Admin panel: http://localhost:8000/admin/

## Project Structure

```
Backend/
├── config/          # Django settings, urls, celery, wsgi/asgi
├── core/            # Middleware, permissions, throttling, utils
├── accounts/        # UserProfile, Telegram auth, JWT, init endpoint
├── game/            # Mining, upgrades, ascension, leaderboard, network tiers
├── pvp/             # PvP system (search, resolve, config, matches)
├── economy/         # Transactions, quests, referrals
├── payments/        # Telegram Stars / TON payments, webhooks
├── season/          # Season lifecycle, history, Celery tasks
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/telegram/` | Authenticate via Telegram initData |
| GET | `/api/v1/auth/init/` | Full state "god object" for app init |

### Mining
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/mining/start/` | Start mining (requires verification) |
| POST | `/api/v1/mining/stop/` | Stop mining + harvest |
| POST | `/api/v1/mining/harvest/` | Harvest without stopping |

### Upgrades & Progression
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/upgrade/buy/` | Buy an upgrade level |
| POST | `/api/v1/ascend/` | Ascend to next generation |

### PvP
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/pvp/search/` | Find a matchmade opponent |
| POST | `/api/v1/pvp/resolve/` | Execute PvP with server RNG |

### Economy
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/economy/transactions/` | Transaction history |
| POST | `/api/v1/economy/quest/claim/` | Claim quest reward |
| GET | `/api/v1/economy/referrals/` | Referral list + code |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/payments/verify/` | Verify payment (verification, fight refill) |
| POST | `/api/v1/payments/webhook/telegram/` | Telegram payment webhook |
| GET | `/api/v1/payments/history/` | Payment history |

### Season
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/season/active/` | Current active season |
| GET | `/api/v1/season/history/` | Season history |

### Leaderboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/leaderboard/` | Redis ZSET leaderboard |

## Security

- **Telegram HMAC** validation on auth
- **Redis replay protection** (prevents init_data reuse)
- **Idempotency keys** on upgrade, PvP, mining stop
- **Rate limiting** (60/min burst, 600/hour sustained)
- **`select_for_update()`** + **`transaction.atomic()`** on all critical paths
- **Shadow ban** system (PvP always loses, no visible restriction)
- **Ban system** with optional expiry

## Game Design

- **Mining**: Server-authoritative, real-time calculation on harvest
- **Energy**: Fixed regen (ENERGY_REGEN_PER_SEC), no upgrade influence
- **PvP**: Pure server-side RNG, 10% wager burn, configurable win chance/multiplier
- **Aggressor system**: Only aggressors can be attacked; decay via Celery
- **Seasons**: Full reset (upgrades, generation, energy), history preserved
- **All balance math**: `Decimal` — no floating point

## Environment Variables

See `.env.example` for all required variables.

## Management Commands

```bash
python manage.py seed_upgrades      # Seed upgrade configs, network tiers, PvP config
python manage.py setup_celery_beat  # Configure periodic Celery Beat tasks
```
