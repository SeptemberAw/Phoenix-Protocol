import { useCallback, useMemo } from 'react';
import {
  miningStart,
  miningStop,
  miningHarvest,
  buyUpgrade,
  ascend as apiAscend,
  pvpSearch,
  pvpResolve,
  claimQuest,
  verifyPayment,
  fetchLeaderboard,
  fetchReferrals,
  ApiPvPResult,
  ApiPublicProfile,
  ApiLeaderboardEntry,
  ApiReferral,
} from '../api';

export function useGameActions() {
  const startMining = useCallback(async (): Promise<{ success: boolean; energy?: number; cooldownRemaining?: number; miningPower?: number; error?: string }> => {
    try {
      const res = await miningStart();
      return { success: true, energy: res.energy, cooldownRemaining: 0, miningPower: res.mining_power ? parseFloat(res.mining_power) : undefined };
    } catch (err: any) {
      const data = err.data || {};
      return { success: false, energy: data.energy, cooldownRemaining: data.cooldown_remaining || 0, error: data.detail || err.message };
    }
  }, []);

  const stopMining = useCallback(async (): Promise<{ mined: number; balance: number; energy: number; is_mining: boolean; cooldownRemaining: number; autoMining?: boolean; autoMiningRemaining?: number } | null> => {
    try {
      const res = await miningStop();
      return { mined: parseFloat(res.mined), balance: parseFloat(res.balance), energy: res.energy, is_mining: res.is_mining ?? false, cooldownRemaining: res.cooldown_remaining ?? 0, autoMining: res.auto_mining, autoMiningRemaining: res.auto_mining_remaining };
    } catch (err: any) {
      const data = err.data || {};
      if (data.cooldown_remaining > 0) {
        return { mined: 0, balance: parseFloat(data.balance || '0'), energy: data.energy || 0, is_mining: data.is_mining ?? true, cooldownRemaining: data.cooldown_remaining };
      }
      console.error('Stop mining failed:', err);
      return null;
    }
  }, []);

  const harvest = useCallback(async (): Promise<{ mined: number; balance: number; energy: number; maxEnergy: number; is_mining: boolean; miningPower: number; autoMining?: boolean; turboActive?: boolean; autoMiningRemaining?: number; turboRemaining?: number } | null> => {
    try {
      const res = await miningHarvest();
      return { mined: parseFloat(res.mined), balance: parseFloat(res.balance), energy: res.energy, maxEnergy: res.max_energy ?? 6000, is_mining: res.is_mining, miningPower: res.mining_power ? parseFloat(res.mining_power) : 0, autoMining: res.auto_mining, turboActive: res.turbo_active, autoMiningRemaining: res.auto_mining_remaining, turboRemaining: res.turbo_remaining };
    } catch (err: any) {
      console.error('Harvest failed:', err);
      return null;
    }
  }, []);

  const purchaseUpgrade = useCallback(async (upgradeId: string): Promise<{ balance: number; newLevel: number; maxEnergy: number } | null> => {
    try {
      const res = await buyUpgrade(upgradeId);
      return { balance: parseFloat(res.balance), newLevel: res.new_level, maxEnergy: res.max_energy };
    } catch (err: any) {
      console.error('Upgrade failed:', err);
      return null;
    }
  }, []);

  const doAscend = useCallback(async (): Promise<{ generation: number; balance: number; energy: number } | null> => {
    try {
      const res = await apiAscend();
      return { generation: res.generation, balance: parseFloat(res.balance), energy: res.energy };
    } catch (err: any) {
      console.error('Ascend failed:', err);
      return null;
    }
  }, []);

  const searchOpponent = useCallback(async (): Promise<ApiPublicProfile | null> => {
    try {
      const res = await pvpSearch();
      return res.opponent;
    } catch (err: any) {
      console.error('PvP search failed:', err);
      return null;
    }
  }, []);

  const resolvePvP = useCallback(async (opponentId: number, wager: number): Promise<ApiPvPResult | null> => {
    try {
      return await pvpResolve(opponentId, wager);
    } catch (err: any) {
      console.error('PvP resolve failed:', err);
      return null;
    }
  }, []);

  const doClaimQuest = useCallback(async (questId: number): Promise<{ reward: number; balance: number } | null> => {
    try {
      const res = await claimQuest(questId);
      return { reward: parseFloat(res.reward), balance: parseFloat(res.balance) };
    } catch (err: any) {
      console.error('Quest claim failed:', err);
      return null;
    }
  }, []);

  const doVerifyPayment = useCallback(async (paymentType: string, chargeId?: string): Promise<{ isVerified: boolean; fightsLeft: number } | null> => {
    try {
      const res = await verifyPayment(paymentType, chargeId);
      return { isVerified: res.is_verified, fightsLeft: res.fights_left };
    } catch (err: any) {
      console.error('Payment verification failed:', err);
      return null;
    }
  }, []);

  const getLeaderboard = useCallback(async (limit = 100, offset = 0, period: 'week' | 'month' | 'all' = 'week'): Promise<{
    leaderboard: ApiLeaderboardEntry[];
    myRank: number | null;
    myScore: number;
    myWeekScore: number;
    myMonthScore: number;
    myNetworth: number;
    myWeekRank: number;
    myMonthRank: number;
    myAllTimeRank: number;
    myPeakWeekRank: number;
    myPeakMonthRank: number;
    myPeakAllTimeRank: number;
    myReferralCount: number;
  } | null> => {
    try {
      const res = await fetchLeaderboard(limit, offset, period);
      return {
        leaderboard: res.leaderboard,
        myRank: res.my_rank,
        myScore: res.my_score,
        myWeekScore: res.my_week_score ?? 0,
        myMonthScore: res.my_month_score ?? 0,
        myNetworth: res.my_networth ?? 0,
        myWeekRank: res.my_week_rank,
        myMonthRank: res.my_month_rank,
        myAllTimeRank: res.my_all_time_rank,
        myPeakWeekRank: res.my_peak_week_rank ?? 0,
        myPeakMonthRank: res.my_peak_month_rank ?? 0,
        myPeakAllTimeRank: res.my_peak_all_time_rank ?? 0,
        myReferralCount: res.my_referral_count,
      };
    } catch (err: any) {
      console.error('Leaderboard fetch failed:', err);
      return null;
    }
  }, []);

  const getReferrals = useCallback(async (): Promise<{
    referralCode: string;
    count: number;
    referrals: ApiReferral[];
  } | null> => {
    try {
      const res = await fetchReferrals();
      return { referralCode: res.referral_code, count: res.count, referrals: res.referrals };
    } catch (err: any) {
      console.error('Referrals fetch failed:', err);
      return null;
    }
  }, []);

  return useMemo(() => ({
    startMining,
    stopMining,
    harvest,
    purchaseUpgrade,
    doAscend,
    searchOpponent,
    resolvePvP,
    doClaimQuest,
    doVerifyPayment,
    getLeaderboard,
    getReferrals,
  }), [startMining, stopMining, harvest, purchaseUpgrade, doAscend, searchOpponent, resolvePvP, doClaimQuest, doVerifyPayment, getLeaderboard, getReferrals]);
}
