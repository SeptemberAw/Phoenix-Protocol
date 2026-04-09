const API_BASE = '/api/v1';

let accessToken: string | null = localStorage.getItem('access_token');
let refreshToken: string | null = localStorage.getItem('refresh_token');
let isRefreshing = false;
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: Error) => void }> = [];

function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
}

function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

function getAccessToken(): string | null {
  return accessToken;
}

async function refreshAccessToken(): Promise<string> {
  if (!refreshToken) throw new Error('No refresh token');

  const res = await fetch(`${API_BASE}/auth/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: refreshToken }),
  });

  if (!res.ok) {
    clearTokens();
    throw new Error('Token refresh failed');
  }

  const data = await res.json();
  setTokens(data.access, data.refresh || refreshToken!);
  return data.access;
}

async function getValidToken(): Promise<string> {
  const token = getAccessToken();
  if (token) return token;
  return refreshAccessToken();
}

async function apiRequest<T = any>(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    auth?: boolean;
    retry?: boolean;
  } = {}
): Promise<T> {
  const { method = 'GET', body, auth = true, retry = true } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth) {
    const token = await getValidToken();
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth && retry) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        refreshQueue.forEach(q => q.resolve(newToken));
        refreshQueue = [];
      } catch (err) {
        isRefreshing = false;
        refreshQueue.forEach(q => q.reject(err as Error));
        refreshQueue = [];
        throw err;
      }
    } else {
      await new Promise<string>((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      });
    }
    return apiRequest<T>(endpoint, { ...options, retry: false });
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    const error: any = new Error(errorData.detail || 'API Error');
    error.status = res.status;
    error.data = errorData;
    throw error;
  }

  return res.json();
}

function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Auth ───────────────────────────────────────────
export async function telegramAuth(initData: string, referralCode?: string) {
  const data = await apiRequest<{ access: string; refresh: string; is_new: boolean }>(
    '/auth/telegram/',
    { method: 'POST', body: { init_data: initData, referral_code: referralCode || '' }, auth: false }
  );
  setTokens(data.access, data.refresh);
  return data;
}

export async function fetchInit() {
  return apiRequest<{
    user: ApiUserProfile;
    upgrades: ApiUpgrade[];
    active_quests: ApiQuest[];
    bot_username?: string;
    referral_bonus_percent?: number;
    total_players?: number;
  }>('/auth/init/');
}

// ─── Mining ─────────────────────────────────────────
export async function miningStart() {
  return apiRequest<{ detail: string; energy: number; cooldown_remaining: number; mining_power?: string }>('/mining/start/', { method: 'POST', body: {} });
}

export async function miningStop() {
  return apiRequest<{ detail: string; mined: string; balance: string; energy: number; is_mining: boolean; cooldown_remaining: number; auto_mining?: boolean; auto_mining_remaining?: number }>(
    '/mining/stop/',
    { method: 'POST', body: { idempotency_key: generateIdempotencyKey() } }
  );
}

export async function miningHarvest() {
  return apiRequest<{ mined: string; balance: string; energy: number; max_energy: number; is_mining: boolean; mining_power?: string; auto_mining?: boolean; turbo_active?: boolean; auto_mining_remaining?: number; turbo_remaining?: number }>(
    '/mining/harvest/',
    { method: 'POST', body: {} }
  );
}

// ─── Upgrades ───────────────────────────────────────
export async function buyUpgrade(upgradeId: string) {
  return apiRequest<{ balance: string; upgrade_id: string; new_level: number; max_energy: number }>(
    '/upgrade/buy/',
    { method: 'POST', body: { upgrade_id: upgradeId, idempotency_key: generateIdempotencyKey() } }
  );
}

export async function ascend() {
  return apiRequest<{ generation: number; balance: string; energy: number }>(
    '/ascend/',
    { method: 'POST', body: {} }
  );
}

// ─── PvP ────────────────────────────────────────────
export async function pvpSearch() {
  return apiRequest<{ opponent: ApiPublicProfile }>('/pvp/search/', { method: 'POST', body: {} });
}

export async function pvpResolve(opponentId: number, wager: number) {
  return apiRequest<ApiPvPResult>(
    '/pvp/resolve/',
    { method: 'POST', body: { opponent_id: opponentId, wager: wager.toFixed(4), idempotency_key: generateIdempotencyKey() } }
  );
}

// ─── Leaderboard ────────────────────────────────────
export async function fetchLeaderboard(limit = 100, offset = 0, period: 'week' | 'month' | 'all' = 'week') {
  return apiRequest<{
    leaderboard: ApiLeaderboardEntry[];
    my_rank: number | null;
    my_score: number;
    my_networth: number;
    my_week_score: number;
    my_month_score: number;
    my_week_rank: number;
    my_month_rank: number;
    my_all_time_rank: number;
    my_peak_week_rank: number;
    my_peak_month_rank: number;
    my_peak_all_time_rank: number;
    my_referral_count: number;
    my_mining_power: number;
  }>(`/leaderboard/?limit=${limit}&offset=${offset}&period=${period}`);
}

// ─── Block Feed ──────────────────────────────────────
export interface ApiBlock {
  id: number;
  hash: string;
  reward: number;
  finder: string;
  difficulty: string;
  participants: number;
  created_at: string;
}

export async function fetchBlockFeed(limit = 10) {
  return apiRequest<{ blocks: ApiBlock[] }>(`/blocks/?limit=${limit}`);
}

// ─── Economy ────────────────────────────────────────
export async function fetchTransactions(type?: string, limit = 50) {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  params.set('limit', String(limit));
  return apiRequest<ApiTransaction[]>(`/economy/transactions/?${params}`);
}

export async function claimQuest(questId: number) {
  return apiRequest<{ detail: string; reward: string; balance: string }>(
    '/economy/quest/claim/',
    { method: 'POST', body: { quest_id: questId } }
  );
}

export async function fetchReferrals() {
  return apiRequest<{ referral_code: string; count: number; referrals: ApiReferral[] }>(
    '/economy/referrals/'
  );
}

// ─── Payments ───────────────────────────────────────
export interface PaymentResult {
  detail: string;
  provider: string;
  transaction_id: number;
  is_verified: boolean;
  fights_left: number;
  energy: number;
  network_tier?: string;
}

export async function createInvoice(paymentType: string) {
  return apiRequest<{ invoice_url: string; stars_amount: number }>(
    '/payments/create-invoice/',
    { method: 'POST', body: { payment_type: paymentType } }
  );
}

export async function verifyPayment(paymentType: string, chargeId?: string) {
  return apiRequest<PaymentResult>(
    '/payments/verify/',
    { method: 'POST', body: { payment_type: paymentType, charge_id: chargeId || '' } }
  );
}

export async function verifyTonPayment(paymentType: string, txHash: string, senderAddress?: string) {
  return apiRequest<PaymentResult>(
    '/payments/ton/verify/',
    { method: 'POST', body: { payment_type: paymentType, tx_hash: txHash, sender_address: senderAddress || '' } }
  );
}

export async function saveWallet(address: string) {
  return apiRequest<{ detail: string; ton_wallet_address: string }>(
    '/payments/wallet/',
    { method: 'POST', body: { address } }
  );
}

export async function disconnectWallet() {
  return apiRequest<{ detail: string }>(
    '/payments/wallet/',
    { method: 'DELETE' }
  );
}

export async function fetchPaymentPrices() {
  return apiRequest<{
    stars: Record<string, number>;
    ton: Record<string, number>;
    treasury_wallet: string;
  }>('/payments/prices/');
}

export async function fetchPaymentHistory() {
  return apiRequest<ApiPayment[]>('/payments/history/');
}

// ─── Season ─────────────────────────────────────────
export async function fetchActiveSeason() {
  return apiRequest<ApiSeason | null>('/season/active/');
}

export async function fetchSeasonHistory() {
  return apiRequest<ApiSeasonHistory[]>('/season/history/');
}

// ─── API Types ──────────────────────────────────────
export interface ApiUserProfile {
  telegram_id: number;
  username: string;
  avatar_url: string;
  balance: string;
  week_earned: string;
  month_earned: string;
  season_balance: string;
  networth: string;
  lifetime_balance: string;
  energy: number;
  max_energy: number;
  generation: number;
  rank_score: number;
  is_mining: boolean;
  aggressor_level: number;
  fights_left: number;
  is_verified: boolean;
  referral_code: string;
  network_tier: string;
  network_multiplier: number;
  referral_count: number;
  auto_mining_until: string | null;
  turbo_boost_until: string | null;
}

export interface ApiPublicProfile {
  telegram_id: number;
  username: string;
  balance: string;
  generation: number;
  rank_score: number;
  aggressor_level: number;
  network_tier: string;
}

export interface ApiUpgrade {
  id: string;
  name: string;
  description: string;
  category: string;
  base_cost: string;
  cost_multiplier: number;
  max_level: number;
  benefit_per_level: number;
  current_level: number;
  next_cost: string | null;
}

export interface ApiQuest {
  id: number;
  type: string;
  title: string;
  description: string;
  reward: number;
  icon: string;
  button_label: string;
  action_url: string;
  target_progress: number;
  current_progress: number;
  is_completed: boolean;
}

export interface ApiPvPResult {
  result: 'win' | 'loss';
  wager: string;
  tax_burned: string;
  balance_change: string;
  new_balance: string;
  fights_left: number;
  opponent: {
    telegram_id: number;
    username: string;
  };
}

export interface ApiLeaderboardEntry {
  rank: number;
  username: string;
  balance: number;       // period score (week_earned / month_earned / networth)
  networth: number;      // all-time earnings — always shown in cards
  week_earned: number;
  month_earned: number;
  generation: number;
  is_current_user: boolean;
  referral_count: number;
  lifetime_balance?: number; // legacy
  mining_power: number;
}

export interface ApiTransaction {
  id: number;
  tx_type: string;
  amount: string;
  balance_after: string;
  detail: string;
  created_at: string;
}

export interface ApiReferral {
  telegram_id: number;
  telegram_username: string;
  balance: string;
  created_at: string;
}

export interface ApiPayment {
  id: number;
  payment_type: string;
  provider: string;
  status: string;
  amount: string;
  created_at: string;
}

export interface ApiSeason {
  id: number;
  number: number;
  name: string;
  is_active: boolean;
  started_at: string;
  ends_at: string;
}

export interface ApiSeasonHistory {
  id: number;
  season_number: number;
  season_name: string;
  final_balance: string;
  final_rank: number;
  final_generation: number;
}

export { clearTokens, getAccessToken };
