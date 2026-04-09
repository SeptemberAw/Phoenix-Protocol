import { useState, useEffect, useCallback, useRef } from 'react';
import {
  telegramAuth,
  fetchInit,
  getAccessToken,
  clearTokens,
  ApiUserProfile,
  ApiUpgrade,
  ApiQuest,
} from '../api';

export interface InitData {
  user: ApiUserProfile;
  upgrades: ApiUpgrade[];
  quests: ApiQuest[];
  botUsername: string;
  totalPlayers: number;
}

export function useAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [initData, setInitData] = useState<InitData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const didRun = useRef(false);

  // Debug: Clear tokens function
  const clearTokensForTesting = () => {
    console.log('🧹 Clearing all tokens for testing...');
    clearTokens();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.reload();
  };

  // Add to window for testing
  if (typeof window !== 'undefined') {
    (window as any).clearTokensForTesting = clearTokensForTesting;
  }

  const authenticate = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const existingToken = getAccessToken();
      console.log('🔑 Existing token:', !!existingToken);

      if (!existingToken) {
        const tgInitData = window.Telegram?.WebApp?.initData;
        const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param || '';
        const referralCode = startParam.startsWith('r_') ? startParam.slice(2) : '';
        
        console.log('📱 Telegram data:', { 
          hasInitData: !!tgInitData, 
          startParam,
          referralCode: referralCode || 'none'
        });
        
        if (!tgInitData) {
          setError('No Telegram WebApp context. Please open from Telegram.');
          setIsLoading(false);
          return;
        } else {
          console.log('🔗 Attempting auth with referral code:', referralCode);
          await telegramAuth(tgInitData, referralCode);
        }
      }

      // Always fetch initial game state after auth
      const data = await fetchInit();
      setInitData({
        user: data.user,
        upgrades: data.upgrades,
        quests: data.active_quests,
        botUsername: data.bot_username || 'purexprotocol_bot',
        totalPlayers: data.total_players || 0,
      });
      setIsAuthenticated(true);

      // Tell Telegram WebApp we're ready
      window.Telegram?.WebApp?.ready();
      window.Telegram?.WebApp?.expand();
      // TG Mini App: set header color and background
      window.Telegram?.WebApp?.setHeaderColor?.('#050505');
      window.Telegram?.WebApp?.setBackgroundColor?.('#050505');
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err.response?.data?.init_data) {
        setError(err.response.data.init_data[0]);
      } else {
        setError('Authentication failed. Please try again.');
      }
      setIsAuthenticated(false);
      setInitData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const data = await fetchInit();
      setInitData({
        user: data.user,
        upgrades: data.upgrades,
        quests: data.active_quests,
        botUsername: data.bot_username || 'purexprotocol_bot',
        totalPlayers: data.total_players || 0,
      });
    } catch (err: any) {
      console.error('State refresh failed:', err);
    }
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setIsAuthenticated(false);
    setInitData(null);
  }, []);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    authenticate();
  }, []);

  return {
    isLoading,
    isAuthenticated,
    initData,
    error,
    refreshState,
    logout,
    retry: authenticate,
  };
}
