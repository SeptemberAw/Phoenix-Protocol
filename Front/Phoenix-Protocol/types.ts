
export enum Tab {
  MINE = 'Mine',
  FIGHT = 'Fight',
  TOP = 'Top',
  HUB = 'Hub',
  EARN = 'Earn'
}

export type TimeFilter = 'day' | 'week' | 'month';
export type NetworkTier = 'Neural Link' | 'Satellite Grid' | 'Quantum Mesh' | 'Singularity';
export type UpgradeCategory = 'energy' | 'mining' | 'passive' | 'recharge';
export type TaskType = 'social' | 'referral' | 'wallet' | 'partner' | 'daily';

export interface UpgradeItem {
  id: string;
  name: string;
  description: string;
  category: UpgradeCategory;
  baseCost: number;
  costMultiplier: number;
  currentLevel: number;
  maxLevel: number;
  benefitPerLevel: number;
}

export interface UserData {
  username: string;
  avatarUrl: string;
  rank: string;
  balance: number;
  energy: number;
  maxEnergy: number;
  generation: number;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  balance: number;
  isCurrentUser?: boolean;
  blocksMined: number;
  topStreak: number;
  seasonPeakRank: number;
  referrals: number;
  generation?: number;
  networth?: number;
  weekEarned?: number;
  monthEarned?: number;
  lifetimeBalance?: number;
  hashRate?: number;
  peakWeekRank?: number;
  peakMonthRank?: number;
  peakAllTimeRank?: number;
}

export interface Friend { id: string; username: string; joinedDate: string; totalBalance: number; earnedForYou: number; }

export interface Task { 
  id: string; 
  type: TaskType;
  title: string; 
  description: string;
  reward: number; 
  icon: string; 
  isCompleted: boolean; 
  currentProgress?: number; 
  targetProgress?: number; 
  actionUrl?: string; 
  buttonLabel?: string;
}

export interface MinedBlock { id: string; finder: string; hash: string; difficulty: string; reward: number; participants: number; timestamp: string; }
export interface NotificationItem { id: string; title: string; message: string; date: string; read: boolean; }
