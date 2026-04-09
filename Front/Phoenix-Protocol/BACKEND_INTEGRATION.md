
# Protocol Hash: Backend Architecture Blueprint (v2.0)

This document serves as the master specification for integrating the **CashinHash** frontend with a Python/Django backend. 

## 1. System Overview

The backend acts as the "Oracle" and "Bank". The frontend is a "Terminal" that visualizes state.
*   **Auth:** `initData` from Telegram.
*   **DB:** PostgreSQL.
*   **Cache:** Redis (Crucial for Leaderboards and Energy counters).
*   **Admin:** Django Admin is the game control center (Economy balancing, Quest management).

---

## 2. Django Admin & Configuration (Game Design)

To allow game balancing without code deploys, the following must be editable via Django Admin.

### A. The "Upgrade Bay" (Shop Config)
**Model:** `UpgradeConfig`
Allows adding new hardware or adjusting costs/benefits on the fly.
*   `id`: string (e.g., 'u1', 'u2') - *Must match frontend constants*.
*   `name`: string (e.g., "Neural Buffer")
*   `category`: ChoiceField ('energy', 'mining', 'recharge', 'passive')
*   `base_cost`: Decimal (e.g., 1000)
*   `cost_multiplier`: Float (e.g., 1.5 - exponential cost growth)
*   `max_level`: Integer (e.g., 20)
*   `benefit_per_level`: Float (e.g., 500 energy or 0.005 hash power)

### B. The "Task Protocol" (Quest System)
**Model:** `Quest`
Dynamic quest injection.
*   `type`: ChoiceField ('social', 'referral', 'wallet', 'partner', 'daily')
*   `title`: string
*   `description`: text
*   `reward`: Integer (CHASH amount)
*   `action_url`: URL (for social/partner)
*   `target_progress`: Integer (e.g., 1 for clicks, 5 for "Invite 5 friends")
*   `is_active`: Boolean
*   `icon_key`: string (maps to frontend Lucide icons: 'twitter', 'wallet', 'users')

### C. Network Tiers
**Model:** `NetworkTier`
*   `name`: string (e.g., "Quantum Mesh")
*   `multiplier`: Float (e.g., 2.0)
*   `requirement_type`: Choice ('mined_amount', 'referrals', 'stars_payment')
*   `requirement_value`: Integer
*   `stars_cost`: Integer (if paid)

---

## 3. Data Models (User State)

**Model:** `UserProfile`
Linked to `django.contrib.auth.models.User` (username = Telegram ID).

| Field | Type | Description |
|-------|------|-------------|
| `telegram_id` | BigInt | Primary Key / Index. |
| `balance` | Decimal(20, 4) | The "CHASH" token balance. |
| `energy` | Integer | Current mining energy. |
| `last_energy_update` | DateTime | Timestamp for server-side regen calc. |
| `generation` | Integer | Ascension level (Default: 1). |
| `rank_score` | Integer | Cached metric for leaderboard sorting. |
| `aggressor_level` | Float (0-100) | PvP Risk Index. Decays over time. |
| `fights_left` | Integer | Daily PvP limit. Resets at 00:00 UTC. |
| `is_verified` | Boolean | True if user passed "Identity Sync" (Payment). |
| `referral_code` | String | Unique invite code. |
| `referred_by` | FK(UserProfile) | Who invited this user. |

**Model:** `UserUpgrade`
*   `user`: FK(UserProfile)
*   `config`: FK(UpgradeConfig)
*   `level`: Integer

**Model:** `UserQuest`
*   `user`: FK(UserProfile)
*   `quest`: FK(Quest)
*   `progress`: Integer
*   `is_claimed`: Boolean
*   `completed_at`: DateTime

---

## 4. API Endpoints Specification

### A. Initialization (The "God Object")
**GET** `/api/v1/init/`
Returns the complete state to render the app instantly.
```json
{
  "user": {
    "balance": 15000.50,
    "energy": 4500,
    "max_energy": 6000,
    "generation": 2,
    "tier": "Satellite Grid",
    "risk_index": 45.2,
    "fights_left": 5
  },
  "upgrades": [ ...list of current levels and costs... ],
  "active_quests": [ ...list of incomplete/claimed quests... ],
  "notifications": [ ...unread system mails... ]
}
```

### B. Mining Loop (Heartbeat)
**POST** `/api/v1/sync/`
*   **Input:** `click_count` (since last sync).
*   **Logic:**
    1.  Validate `click_count` against `time_elapsed` * `MAX_CLICKS_PER_SEC`.
    2.  Calculate: `Reward = (Base_Power + Upgrade_Boost) * Gen_Mult * Network_Mult`.
    3.  Credit Balance. Deduct Energy.
*   **Response:** `{ "balance": ..., "energy": ... }`

### C. Economy & Shop
**POST** `/api/v1/upgrade/buy/`
*   **Input:** `upgrade_id`
*   **Logic:**
    1.  Calculate Cost: `Base * (10^(Gen-1)) * (Mult ^ Level)`.
    2.  Check Balance > Cost.
    3.  Deduct Balance, Increment Level.
    4.  If category == 'energy', recalculate `max_energy`.

**POST** `/api/v1/ascend/`
*   **Logic:** Reset all `UserUpgrades` to lvl 0. Increment `generation`. Reset `energy` to default. Keep `balance`.

### D. PvP System
**POST** `/api/v1/pvp/search/`
*   **Logic:** Find a random user with similar `balance` (+/- 20%).
*   **Response:** `{ "opponent_id": 123, "name": "Node_X", "balance": ... }`

**POST** `/api/v1/pvp/resolve/`
*   **Input:** `wager`, `result` (win/loss), `opponent_id`.
*   **Server Logic:**
    1.  Validate `wager` <= `balance`.
    2.  Increase `aggressor_level`.
    3.  Decrement `fights_left`.
    4.  If Win: `Balance += Wager * 1.5 * 0.85` (15% tax).
    5.  If Loss: `Balance -= Wager`.

### E. Quests & Referrals
**POST** `/api/v1/quest/claim/`
*   **Input:** `quest_id`
*   **Logic:**
    *   If `type == referral`: Check `UserProfile.objects.filter(referred_by=user).count() >= target`.
    *   If `type == social`: Trust client (or check simple timestamp).
    *   Credit reward.

---

## 5. Mathematical Formulas

**1. Mining Power (Hash Rate):**
```python
power = (0.005 + (Core_Lvl * 0.005)) * 4 * (5 ^ (Gen - 1)) * Tier_Mult
```

**2. Upgrade Cost:**
```python
cost = Base_Cost * (10 ** (Gen - 1)) * (Cost_Mult ** Current_Lvl)
```

**3. PvP Tax:**
Fixed at **15%** of the Wager on wins. 
`Net_Win = (Wager * 1.5) - (Wager * 0.15)`

---

## 6. Security & Anti-Cheat

1.  **Energy Desync:**
    The server calculates energy regeneration (`Regen_Rate * time_elapsed`). If the client claims to have mined more energy than physically possible since the last sync, reject the sync.

2.  **PvP Validation:**
    The backend must verify the user actually *has* the wager amount before processing the result. Do not trust the client's balance blindly.

3.  **Bot Detection:**
    If `sync` requests arrive at perfectly regular intervals (e.g., exactly every 1000ms) with zero variance for prolonged periods, flag `is_flagged=True`.

## 7. Telegram Payments (Stars/TON)

1.  **Invoice Generation:** Create invoice with payload `type=verification|fight_refill` and `user_id`.
2.  **Pre-Checkout:** Verify user exists.
3.  **Successful Payment:**
    *   If `verification`: Set `is_verified = True`.
    *   If `fight_refill`: Set `fights_left = 5`.
    *   Log transaction in `TransactionHistory` model.
