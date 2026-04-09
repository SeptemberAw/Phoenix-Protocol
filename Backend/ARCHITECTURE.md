# CashinHash Backend — Architecture & Agent Handoff Document

> **Цель документа:** дать любому AI-агенту (или человеку) полное понимание проекта,
> чтобы можно было безопасно продолжить разработку, не сломав существующую логику.
>
> **Дата создания:** 2026-02-25
> **Статус:** Backend полностью реализован, `manage.py check` — 0 issues, миграции сгенерированы.

---

## 1. ОБЩАЯ ФИЛОСОФИЯ

- **Server-authoritative.** Фронтенд — dumb terminal. Клиент НЕ вычисляет баланс, энергию, результат PvP. Всё считает сервер.
- **Decimal everywhere.** Все финансовые поля — `Decimal(20, 4)`. Никаких `float` в балансах.
- **Atomic + select_for_update.** Каждый критический endpoint оборачивает `UserProfile` в `transaction.atomic()` + `select_for_update()` — это предотвращает race conditions.
- **Idempotency.** Ключевые мутации (upgrade, pvp, mining stop) принимают `idempotency_key` — повтор в течение 60с вернёт 409.
- **Replay protection.** Telegram `init_data` hash кэшируется в Redis на 5 минут — повторная отправка отклоняется.

---

## 2. СТЕК И ЗАВИСИМОСТИ

| Компонент        | Версия    | Назначение                                    |
|------------------|-----------|-----------------------------------------------|
| Python           | 3.12+     | Runtime                                       |
| Django           | 5.1.4     | Web framework                                 |
| DRF              | 3.15.2    | REST API                                      |
| SimpleJWT        | 5.4.0     | JWT auth (access 24h, refresh 7d)             |
| PostgreSQL       | 16        | Primary DB                                    |
| Redis            | 7         | Cache, leaderboard ZSET, replay/idempotency   |
| Celery           | 5.4.0     | Background tasks                              |
| django-celery-beat | 2.7.0   | Periodic task scheduler (DB-backed)           |
| django-redis     | 5.4.0     | Django cache backend → Redis                  |
| django-cors-headers | 4.6.0  | CORS                                          |
| psycopg2-binary  | 2.9.10    | PostgreSQL adapter                            |
| python-dotenv    | 1.0.1     | .env loading                                  |
| gunicorn         | 23.0.0    | WSGI server                                   |

Файл: `requirements.txt`

---

## 3. СТРУКТУРА ПРОЕКТА

```
Backend/
├── config/                # Django project config
│   ├── __init__.py        # Экспортирует celery_app
│   ├── settings.py        # Все настройки, game constants внизу файла
│   ├── urls.py            # Корневой router → apps
│   ├── celery.py          # Celery app + autodiscover
│   ├── wsgi.py
│   └── asgi.py
│
├── core/                  # Общий код (НЕ имеет моделей)
│   ├── middleware.py       # BanCheckMiddleware
│   ├── permissions.py      # IsVerified, IsNotBanned
│   ├── throttling.py       # GameBurstRateThrottle, GameSustainedRateThrottle
│   └── utils.py            # HMAC validation, replay, idempotency, custom exceptions
│
├── accounts/              # Пользователи и аутентификация
│   ├── models.py           # UserProfile (центральная модель)
│   ├── authentication.py   # TelegramAuthSerializer (HMAC → JWT)
│   ├── serializers.py      # UserProfileSerializer, PublicProfileSerializer
│   ├── views.py            # TelegramAuthView, InitView (god-object)
│   ├── admin.py
│   └── urls.py             # /api/v1/auth/...
│
├── game/                  # Майнинг, апгрейды, лидерборд
│   ├── models.py           # UpgradeConfig, UserUpgrade, NetworkTier
│   ├── services.py         # ★ КЛЮЧЕВОЙ ФАЙЛ: вся бизнес-логика майнинга
│   ├── serializers.py
│   ├── views.py            # Mining*, UpgradeBuy, Ascend, Leaderboard
│   ├── admin.py
│   ├── urls.py             # /api/v1/mining/... /api/v1/upgrade/... etc
│   └── management/commands/
│       ├── seed_upgrades.py      # Сидирует UpgradeConfig, NetworkTier, PvPConfig
│       └── setup_celery_beat.py  # Создаёт PeriodicTask записи в БД
│
├── pvp/                   # PvP система
│   ├── models.py           # PvPConfig (singleton), PvPMatch
│   ├── services.py         # ★ find_opponent(), resolve_pvp()
│   ├── serializers.py
│   ├── views.py            # PvPSearchView, PvPResolveView
│   ├── admin.py
│   └── urls.py             # /api/v1/pvp/...
│
├── economy/               # Транзакции, квесты, рефералы
│   ├── models.py           # TransactionHistory, Quest, UserQuest
│   ├── services.py         # log_transaction() — единственная функция
│   ├── serializers.py
│   ├── views.py            # TransactionList, QuestClaim, ReferralList
│   ├── admin.py
│   └── urls.py             # /api/v1/economy/...
│
├── payments/              # Платежи Telegram Stars / TON
│   ├── models.py           # PaymentTransaction
│   ├── serializers.py
│   ├── views.py            # VerifyPayment, TelegramWebhook, PaymentHistory
│   ├── admin.py
│   └── urls.py             # /api/v1/payments/...
│
├── season/                # Сезоны
│   ├── models.py           # Season, SeasonHistory
│   ├── tasks.py            # ★ Celery tasks: decay, reset_fights, end_season, auto_stop
│   ├── serializers.py
│   ├── views.py            # ActiveSeason, SeasonHistory
│   ├── admin.py
│   └── urls.py             # /api/v1/season/...
│
├── docker-compose.yml     # django, postgres, redis, celery_worker, celery_beat
├── Dockerfile
├── manage.py
├── requirements.txt
├── .env.example
└── README.md
```

---

## 4. ЦЕНТРАЛЬНАЯ МОДЕЛЬ: UserProfile

**Файл:** `accounts/models.py`
**Связь:** `OneToOneField → django.contrib.auth.User` (username = str(telegram_id))
**Доступ из request:** `request.user.profile`

### Ключевые поля и их роли:

| Поле | Тип | Кто пишет | Комментарий |
|------|-----|-----------|-------------|
| `telegram_id` | BigInt, unique | auth | Первичный идентификатор пользователя |
| `balance` | Decimal(20,4) | mining, pvp, upgrade, quest | Текущий баланс CHASH |
| `season_balance` | Decimal(20,4) | те же | Баланс за текущий сезон (для лидерборда) |
| `lifetime_balance` | Decimal(20,4) | season_end | Накопленный за все сезоны |
| `energy` | Int | mining, regen | Текущая энергия |
| `max_energy` | Int | upgrade (u1) | Макс. энергия (base 6000 + u1 * 500) |
| `last_energy_update` | DateTime | regen | Timestamp для расчёта регенерации |
| `is_mining` | Bool | mining start/stop | Флаг активного майнинга |
| `mining_started_at` | DateTime | mining start/stop | Начало текущей сессии майнинга |
| `generation` | Int | ascend | Поколение (ascension level) |
| `aggressor_level` | Float 0-100 | pvp, celery decay | Уровень агрессии |
| `fights_left` | Int | pvp, daily reset | Оставшиеся бои (default 5) |
| `is_verified` | Bool | payment | Прошёл оплату → может майнить/PvP/upgrade |
| `is_banned` | Bool | admin | Полный бан (403 на всё) |
| `is_shadow_banned` | Bool | admin | PvP всегда проигрыш, без видимых ограничений |
| `network_tier` | Choice | payment/admin | Множитель сети (1x/1.5x/2x/4x) |
| `referral_code` | Str, unique | auto-gen on save | 12-char hex |
| `referred_by` | FK(self) | auth | Кто пригласил |

### ⚠️ КРИТИЧЕСКИ ВАЖНО: related_name

```python
profile.referrals        # → QuerySet[UserProfile] (referred_by=profile)
profile.upgrades         # → QuerySet[UserUpgrade]
profile.transactions     # → QuerySet[TransactionHistory]
profile.quests           # → QuerySet[UserQuest]
profile.attacks_made     # → QuerySet[PvPMatch] (attacker=profile)
profile.attacks_received # → QuerySet[PvPMatch] (defender=profile)
profile.payments         # → QuerySet[PaymentTransaction]
profile.season_history   # → QuerySet[SeasonHistory]
```

---

## 5. ГРАФ ЗАВИСИМОСТЕЙ МЕЖДУ ПРИЛОЖЕНИЯМИ

```
accounts  ←──  game.services (harvest_mining, start_mining, etc.)
    ↑              ↑
    │              │
    ├── pvp.services (resolve_pvp → harvest_mining, update_leaderboard)
    │
    ├── economy.services (log_transaction ← используется ВСЕМИ)
    │
    ├── payments.views (→ PvPConfig.load(), log_transaction)
    │
    └── season.tasks (→ UserProfile, UserUpgrade, Season, harvest_mining)
```

**Правило:** `economy.services.log_transaction()` — единая точка записи транзакций.
Любая операция с балансом ОБЯЗАНА вызывать эту функцию.

---

## 6. MINING SYSTEM — ПОДРОБНАЯ МЕХАНИКА

**Файл-оракул:** `game/services.py` — здесь ВСЯ логика майнинга.

### Жизненный цикл:

```
[Frontend: Start] → POST /mining/start/
    └─ start_mining(profile):
        1. regenerate_energy()          ← Считает regen с last_energy_update
        2. Если is_mining=True → False  ← Уже майнит
        3. Если energy <= 0 → False     ← Нет энергии
        4. is_mining = True, mining_started_at = now()

[Frontend: Stop] → POST /mining/stop/
    └─ stop_mining(profile):
        1. harvest_mining() → mined     ← Собирает накопленное
        2. UPDATE is_mining=False, mining_started_at=None

[Frontend: Harvest / Init / любой endpoint] → harvest_mining(profile):
    1. regenerate_energy()
    2. Если не is_mining → return 0
    3. elapsed = now - mining_started_at
    4. power = get_mining_power(profile)
    5. raw_mined = power * elapsed
    6. energy_needed = raw_mined * ENERGY_COST_RATIO (200)
    7. Если energy_needed > energy:
         raw_mined = energy / ENERGY_COST_RATIO
         energy_needed = energy
    8. energy -= energy_needed
    9. balance += raw_mined, season_balance += raw_mined
    10. Если energy <= 0 → auto-stop (is_mining=False)
    11. Иначе → mining_started_at = now (сброс таймера)
    12. profile.save()
    13. log_transaction() + update_leaderboard()
```

### Формулы:

```python
# Mining power
power = (Decimal("0.005") + core_bonus) * (5 ** (generation - 1)) * network_multiplier
# где core_bonus = UserUpgrade(config_id="u2").level * 0.005

# Energy cost
energy_needed = int(raw_mined * ENERGY_COST_RATIO)  # ENERGY_COST_RATIO = 200

# Energy regen (только когда НЕ майнит)
regen = int(elapsed_seconds * ENERGY_REGEN_PER_SEC)  # ENERGY_REGEN_PER_SEC = 5

# Max energy
max_energy = MAX_ENERGY_DEFAULT + UserUpgrade(config_id="u1").level * 500

# Upgrade cost
cost = base_cost * (10 ** (generation - 1)) * (cost_multiplier ** current_level)
```

### ⚠️ НЕ ЛОМАТЬ:
- `harvest_mining()` вызывается во ВСЕХ endpoints, которые читают профиль (init, upgrade, pvp, ascend).
- `regenerate_energy()` всегда вызывается первой внутри `harvest_mining()`.
- `mining_started_at` сбрасывается на `now()` после каждого harvest — это "сдвиг окна".

---

## 7. PVP SYSTEM — ПОДРОБНАЯ МЕХАНИКА

**Файл-оракул:** `pvp/services.py`

### Конфигурация (singleton):

```python
PvPConfig.load()  # Всегда возвращает единственную запись (pk=1)
# win_chance = 0.5       (50/50)
# win_multiplier = 1.3   (ЖЁСТКО CAPPED: if > 1.3 → 1.3 в save())
# tax_percent = 10.0     (10% burn ВСЕГДА)
# cooldown_same_opponent_minutes = 30
# aggressor_increase_per_fight = 15.0
# daily_fight_limit = 5
```

### Поток resolve_pvp():

```
1. select_for_update() ОБОИХ игроков
2. Валидации:
   - attacker != defender
   - fights_left > 0
   - wager > 0 AND wager <= attacker.balance
   - defender.aggressor_level > 0 (иначе неуязвим!)
   - cooldown check
3. harvest_mining() обоих (чтобы зафиксировать баланс)
4. tax_burned = wager * tax_percent / 100
5. RNG: secrets.randbelow(10000) < win_chance * 10000
   - shadow_banned → ВСЕГДА loss
6. Win:
   - attacker.balance += wager * multiplier - tax_burned
   - defender.balance -= wager
7. Loss:
   - attacker.balance -= wager
   - defender.balance += wager - tax_burned
8. attacker.aggressor_level += aggressor_increase_per_fight
9. attacker.fights_left -= 1
10. save() обоих, create PvPMatch, log_transaction × 2, update_leaderboard × 2
```

### Aggressor System:
- Атака → aggressor_level += 15
- Только игроки с `aggressor_level > 0` могут быть атакованы
- Если не воюешь → aggressor decays → становишься неуязвимым
- Decay: Celery task каждые 12 секунд, `-0.3` за тик

### find_opponent():
- Ищет в диапазоне ±20% баланса
- Только `aggressor_level > 0`, `is_verified=True`, `is_banned=False`
- Исключает cooldown opponents
- `order_by("?")[:10]` — случайная выборка

---

## 8. PAYMENT GATING

Профиль создаётся при первом auth. Но пока `is_verified = False`:
- `POST /mining/start/` → permission denied (IsVerified)
- `POST /pvp/resolve/` → permission denied
- `POST /upgrade/buy/` → permission denied
- `POST /ascend/` → permission denied

`is_verified = True` после:
- `POST /payments/verify/` с `payment_type="verification"`
- Telegram webhook с `type=verification` в payload

---

## 9. SEASON SYSTEM

**Celery task:** `end_season(season_id)` в `season/tasks.py`

### Что происходит при end_season:

```
1. Snapshot всех профилей → SeasonHistory (balance, rank, generation)
2. lifetime_balance += season_balance
3. season_balance = 0
4. generation = 1
5. energy = ENERGY_DEFAULT, max_energy = MAX_ENERGY_DEFAULT
6. is_mining = False, mining_started_at = None
7. UserUpgrade.objects.all().update(level=0)  ← ВСЕ апгрейды сброшены
8. Season.is_active = False, ended_at = now
9. Redis leaderboard key удалён
```

### ⚠️ НЕ ЛОМАТЬ:
- Сезон запускается вручную через admin (создать Season с `is_active=True`).
- `end_season` вызывается тоже вручную или через schedule.
- Только ОДИН сезон может быть `is_active=True`.

---

## 10. REDIS USAGE

| Key pattern | Type | Назначение |
|-------------|------|------------|
| `leaderboard:season:{id}` | ZSET | member=telegram_id, score=season_balance |
| `leaderboard:global` | ZSET | Fallback если нет активного сезона |
| `replay:{hash}` | String, TTL 300s | Защита от повтора init_data |
| `idempotency:{scope}:{user_pk}:{key}` | String, TTL 60s | Защита от повтора мутаций |
| Django cache keys | varies | Throttling counters |

**Доступ к raw Redis:**
```python
from django.core.cache import cache
redis_client = cache.client.get_client()  # → redis.Redis instance
redis_client.zadd(key, {member: score})
```

Redis DB 0 = cache, Redis DB 1 = Celery broker/results.

---

## 11. CELERY TASKS

| Task name | Файл | Интервал | Что делает |
|-----------|-------|----------|------------|
| `decay_aggressor_levels` | season/tasks.py | 12 сек | aggressor_level -= 0.3 для всех >0 |
| `reset_daily_fights` | season/tasks.py | 1 день | fights_left = PvPConfig.daily_fight_limit |
| `auto_stop_zero_energy_miners` | season/tasks.py | 5 мин | harvest + stop если energy=0 |
| `end_season` | season/tasks.py | manual | Полный сезонный ресет |

**Настройка расписания:** `python manage.py setup_celery_beat`

---

## 12. ПОЛНАЯ КАРТА ENDPOINTS

### Auth (accounts/urls.py → /api/v1/auth/)
| Method | Path | View | Permissions | Idempotency |
|--------|------|------|-------------|-------------|
| POST | `/api/v1/auth/telegram/` | TelegramAuthView | AllowAny | replay protection |
| GET | `/api/v1/auth/init/` | InitView | IsAuthenticated | — |

### Mining & Game (game/urls.py → /api/v1/)
| Method | Path | View | Permissions | Idempotency |
|--------|------|------|-------------|-------------|
| POST | `/api/v1/mining/start/` | MiningStartView | Auth + NotBanned + Verified | — |
| POST | `/api/v1/mining/stop/` | MiningStopView | Auth + NotBanned | ✅ idempotency_key |
| POST | `/api/v1/mining/harvest/` | MiningHarvestView | Auth + NotBanned | — |
| POST | `/api/v1/upgrade/buy/` | UpgradeBuyView | Auth + NotBanned + Verified | ✅ idempotency_key |
| POST | `/api/v1/ascend/` | AscendView | Auth + NotBanned + Verified | — |
| GET | `/api/v1/leaderboard/` | LeaderboardView | Auth | — |

### PvP (pvp/urls.py → /api/v1/pvp/)
| Method | Path | View | Permissions | Idempotency |
|--------|------|------|-------------|-------------|
| POST | `/api/v1/pvp/search/` | PvPSearchView | Auth + NotBanned + Verified | — |
| POST | `/api/v1/pvp/resolve/` | PvPResolveView | Auth + NotBanned + Verified | ✅ idempotency_key |

### Economy (economy/urls.py → /api/v1/economy/)
| Method | Path | View | Permissions |
|--------|------|------|-------------|
| GET | `/api/v1/economy/transactions/` | TransactionListView | Auth + NotBanned |
| POST | `/api/v1/economy/quest/claim/` | QuestClaimView | Auth + NotBanned |
| GET | `/api/v1/economy/referrals/` | ReferralListView | Auth |

### Payments (payments/urls.py → /api/v1/payments/)
| Method | Path | View | Permissions |
|--------|------|------|-------------|
| POST | `/api/v1/payments/verify/` | VerifyPaymentView | Auth + NotBanned |
| POST | `/api/v1/payments/webhook/telegram/` | TelegramWebhookView | AllowAny |
| GET | `/api/v1/payments/history/` | PaymentHistoryView | Auth |

### Season (season/urls.py → /api/v1/season/)
| Method | Path | View | Permissions |
|--------|------|------|-------------|
| GET | `/api/v1/season/active/` | ActiveSeasonView | Auth |
| GET | `/api/v1/season/history/` | SeasonHistoryView | Auth |

---

## 13. UPGRADE CONFIG IDs (ФРОНТ ↔ БЭК MAPPING)

Эти ID жёстко связаны между фронтом и бэком. **Менять с осторожностью!**

| config_id | Name | Category | base_cost | cost_mult | max_level | benefit_per_level | Эффект |
|-----------|------|----------|-----------|-----------|-----------|-------------------|--------|
| `u1` | Neural Buffer | energy | 1000 | 1.5 | 20 | 500 | max_energy += 500/level |
| `u2` | Quantum Core | mining | 2500 | 1.8 | 15 | 0.005 | mining power += 0.005/level |
| `u3` | Rapid Cooling | recharge | 1500 | 1.6 | 10 | 2 | (пока не влияет серверно) |
| `u4` | Auto-Sync Bot | passive | 10000 | 2.5 | 5 | 0.1 | (пока не влияет серверно) |

### ⚠️ ВАЖНО:
- `u1` и `u2` имеют серверную логику в `game/services.py` (calculate_max_energy, get_core_bonus).
- `u3` и `u4` — **пока только на фронте**. Серверная логика для них НЕ реализована. Если добавляешь — модифицируй `regenerate_energy()` для u3 и создай отдельный passive mining task для u4.

---

## 14. SECURITY LAYERS

```
Request
  │
  ├─ CORS check (corsheaders middleware)
  │
  ├─ JWT validation (SimpleJWT)
  │
  ├─ BanCheckMiddleware (core/middleware.py)
  │    └─ is_banned? → 403 (с auto-unban по ban_until)
  │
  ├─ DRF Throttling (core/throttling.py)
  │    └─ 60/min burst, 600/hour sustained (per-user)
  │
  ├─ Permission classes на view:
  │    ├─ IsAuthenticated (default)
  │    ├─ IsNotBanned (core/permissions.py)
  │    └─ IsVerified (core/permissions.py) → 403 если не оплатил
  │
  ├─ Idempotency check (core/utils.py → check_idempotency)
  │    └─ Redis key TTL 60s → 409 при повторе
  │
  └─ transaction.atomic() + select_for_update()
       └─ Row-level lock на UserProfile
```

### Shadow Ban:
- `is_shadow_banned = True` → PvP RNG ВСЕГДА возвращает loss
- Никаких видимых ограничений в API responses
- Проверка: `pvp/services.py:92-93`

---

## 15. ПАТТЕРН ВЫЗОВА harvest_mining

Функция `harvest_mining(profile)` — это "catch-up" механизм. Она вычисляет,
сколько было намайнено с `mining_started_at` до `now()`, и применяет результат.

**ГДЕ вызывается:**
1. `game/views.py` → MiningStopView, MiningHarvestView
2. `game/views.py` → UpgradeBuyView (перед расчётом стоимости)
3. `game/views.py` → AscendView (перед ascend)
4. `accounts/views.py` → InitView (при загрузке приложения)
5. `pvp/services.py` → resolve_pvp (для обоих игроков перед боем)
6. `season/tasks.py` → auto_stop_zero_energy_miners

**ПРАВИЛО:** если добавляешь новый endpoint, который читает или пишет `profile.balance` —
ОБЯЗАТЕЛЬНО вызови `harvest_mining(profile)` первым делом внутри atomic block.

---

## 16. ПАТТЕРН log_transaction

```python
from economy.services import log_transaction

log_transaction(
    profile=profile,           # UserProfile instance (уже с обновлённым balance)
    tx_type="mining",          # один из TX_TYPE_CHOICES
    amount=Decimal("123.45"),  # положительный = приход, отрицательный = расход
    detail="описание",         # свободный текст
)
```

**balance_after** записывается автоматически из `profile.balance` на момент вызова.
Поэтому вызывай ПОСЛЕ изменения баланса, но ДО выхода из atomic block.

---

## 17. ПАТТЕРН update_leaderboard

```python
from game.services import update_leaderboard

update_leaderboard(profile)  # ZADD в Redis: score = season_balance
```

Вызывается после: mining, pvp, upgrade, quest_claim, ascend.

---

## 18. KNOWN LIMITATIONS / TODO

1. **u3 (Rapid Cooling)** — benefit_per_level не применяется серверно. На фронте используется для regen rate. Нужно добавить в `regenerate_energy()` если хочешь серверную поддержку.

2. **u4 (Auto-Sync Bot)** — passive mining не реализован серверно. Нужен отдельный Celery task, который периодически делает harvest для пользователей с u4.level > 0.

3. **Network Tier switching** — эндпоинт для смены tier через оплату не полностью реализован. `payments/views.py` логирует "Network tier upgrade", но не меняет `profile.network_tier`. Нужно добавить логику проверки requirements из `game.models.NetworkTier`.

4. **Quest type "partner"** — серверная валидация не определена (нет внешнего API для проверки). Сейчас будет rejected как incomplete.

5. **Bot Detection** — упомянут в frontend docs, но не реализован. Можно добавить middleware/task для анализа паттернов sync-запросов.

6. **Leaderboard по периодам** — фронт ожидает фильтры `day/week/month` (тип `TimeFilter`). Сейчас лидерборд один на сезон. Для периодов нужны отдельные ZSET ключи и Celery задачи для snapshot.

---

## 19. DOCKER COMPOSE SERVICES

| Service | Port | Описание |
|---------|------|----------|
| `django` | 8000 | Web server (gunicorn, auto-migrate + seed on start) |
| `postgres` | 5432 | PostgreSQL 16 |
| `redis` | 6379 | Redis 7 (DB0=cache, DB1=celery) |
| `celery_worker` | — | 4 concurrent workers |
| `celery_beat` | — | Scheduler (DB-backed via django-celery-beat) |

**Запуск:** `docker compose up --build -d`
**Первый раз после запуска:**
```bash
docker compose exec django python manage.py createsuperuser
docker compose exec django python manage.py setup_celery_beat
```

---

## 20. ENV VARIABLES

| Variable | Default | Описание |
|----------|---------|----------|
| `SECRET_KEY` | insecure-dev-key | Django secret |
| `DEBUG` | False | Debug mode |
| `ALLOWED_HOSTS` | localhost,127.0.0.1 | |
| `POSTGRES_DB/USER/PASSWORD/HOST/PORT` | cashinhash/cashinhash/cashinhash/postgres/5432 | |
| `REDIS_URL` | redis://redis:6379/0 | Cache |
| `CELERY_BROKER_URL` | redis://redis:6379/1 | Celery broker |
| `TELEGRAM_BOT_TOKEN` | — | ⚠️ ОБЯЗАТЕЛЬНО для auth |
| `CORS_ALLOWED_ORIGINS` | localhost:3000,5173 | |
| `ENERGY_REGEN_PER_SEC` | 5 | |
| `ENERGY_COST_RATIO` | 200 | |
| `MAX_ENERGY_DEFAULT` | 6000 | |
| `ENERGY_DEFAULT` | 6000 | |

---

## 21. ЧЕКЛИСТ ДЛЯ АГЕНТА: "Я ХОЧУ ДОБАВИТЬ НОВЫЙ ENDPOINT"

1. ✅ Определи, нужен ли `select_for_update()` (если пишешь в UserProfile — ДА)
2. ✅ Оберни в `transaction.atomic()`
3. ✅ Вызови `harvest_mining(profile)` если читаешь balance
4. ✅ Вызови `log_transaction()` если меняешь balance
5. ✅ Вызови `update_leaderboard()` если меняешь season_balance
6. ✅ Добавь permission classes: `[IsAuthenticated, IsNotBanned]` минимум, `+ IsVerified` для game actions
7. ✅ Добавь `idempotency_key` если это мутирующий POST
8. ✅ Все суммы — `Decimal`, НЕ float
9. ✅ Добавь URL в соответствующий `urls.py` приложения
10. ✅ Зарегистрируй в admin если есть новая модель

## 22. ЧЕКЛИСТ: "Я ХОЧУ ИЗМЕНИТЬ БАЛАНС-ФОРМУЛУ"

1. Все формулы в `game/services.py` — `get_mining_power()`, `calculate_max_energy()`, `regenerate_energy()`
2. Upgrade cost формула — в `game/views.py:UpgradeBuyView` и `game/serializers.py:UserUpgradeListSerializer.get_next_cost()`
3. PvP формулы — в `pvp/services.py:resolve_pvp()`
4. PvP конфиг — singleton `pvp/models.py:PvPConfig` (editableчерез admin)
5. Upgrade конфиг — `game/models.py:UpgradeConfig` (editable через admin)
6. Game constants — в `config/settings.py` (внизу файла)

---

## 23. FRONTEND ↔ BACKEND INTEGRATION

Фронтенд полностью интегрирован с бекендом. Все mock-данные заменены на реальные API-вызовы.

### Архитектура фронтенда

| Файл | Назначение |
|------|-----------|
| `api.ts` | Fetch-based API клиент с JWT (access + refresh), auto-refresh при 401, idempotency keys |
| `telegram.d.ts` | TypeScript типы для Telegram WebApp API |
| `hooks/useAuth.ts` | Auth flow: Telegram initData → JWT → fetchInit → populate state |
| `hooks/useGameActions.ts` | Обёртки вокруг всех API endpoints с error handling |
| `App.tsx` | Центральный state manager — синхронизирует server state в local state |

### Auth Flow

1. `useAuth` извлекает `window.Telegram.WebApp.initData`
2. POST `/api/v1/auth/telegram/` → получает JWT tokens
3. GET `/api/v1/auth/init/` → получает user profile, upgrades, quests
4. Данные маппятся в local React state через `useEffect`
5. Telegram `start_param` (`r_XXXXX`) используется как referral code

### Mining Integration

- **Start/Stop** → POST `/api/v1/mining/start/` и `/stop/`
- **Клиентская анимация** продолжает работать для smooth UX (energy countdown, balance increment)
- **Серверная синхронизация** каждые 10с через POST `/api/v1/mining/harvest/`
- **Sync on tab change** — harvest вызывается при переключении вкладок
- **Server is truth** — после каждого harvest local state перезаписывается серверными данными

### PvP Integration (FightsTab)

1. POST `/api/v1/pvp/search/` → получаем реального противника
2. POST `/api/v1/pvp/resolve/` → сервер определяет win/loss (до анимации!)
3. Анимация проигрывается с заранее известным исходом
4. `handleBattleEnd` передаёт `new_balance` и `fights_left` из серверного ответа в parent

### Upgrade/Ascend Integration

- POST `/api/v1/upgrade/buy/` → сервер валидирует и возвращает `{ balance, new_level, max_energy }`
- POST `/api/v1/ascend/` → сервер возвращает `{ generation, balance, energy }`, потом `refreshState()`

### Leaderboard (TopTab)

- GET `/api/v1/leaderboard/` → Redis ZSET данные с `my_rank` и `my_score`
- Fallback на mock data пока API не загрузится

### Referrals (HubTab)

- GET `/api/v1/economy/referrals/` → `{ referral_code, count, referrals[] }`
- Referral link строится динамически: `https://t.me/cashinhash_bot?start=r_{referral_code}`

### Quests (EarnTab)

- Данные передаются как props из `App.tsx` (не отдельный запрос)
- Claim: POST `/api/v1/economy/quest/claim/` → `{ reward, balance }`

### Payment/Verification (VerificationModal)

- POST `/api/v1/payments/verify/` → `{ is_verified, fights_left }`
- `onSuccess` в `App.tsx` вызывает API, потом auto-starts mining

### Vite Proxy

`vite.config.ts` проксирует `/api` → `http://localhost:8000` для dev-режима.

### Token Management

- Tokens хранятся в `localStorage` (`access_token`, `refresh_token`)
- Auto-refresh через POST `/api/v1/auth/token/refresh/`
- При 401 — автоматический refresh и retry запроса
- Очередь запросов ждёт завершения refresh (no thundering herd)

### ВАЖНО для следующего агента

1. **НЕ УДАЛЯЙ `constants.ts`** — это fallback data для случаев когда API ещё не ответил
2. **Client-side mining animation — cosmetic only.** Server overwrites on every harvest
3. **`handleFight` принимает optional `serverBalance` и `serverFightsLeft`** — всегда предпочитай серверные данные
4. **EarnTab получает quests через props**, не делает свой API-вызов
5. **Все мутирующие POST запросы** отправляют `idempotency_key`

---

*Конец документа. Удачной разработки!*
