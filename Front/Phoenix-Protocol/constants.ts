
import { LeaderboardEntry, Task, Friend, MinedBlock, NotificationItem, UpgradeItem } from './types';

export const INITIAL_UPGRADES: UpgradeItem[] = [
  {
    id: 'u1',
    name: 'Neural Buffer',
    description: 'Increases maximum energy capacity of your node.',
    category: 'energy',
    baseCost: 1000,
    costMultiplier: 1.5,
    currentLevel: 1,
    maxLevel: 20,
    benefitPerLevel: 500
  },
  {
    id: 'u2',
    name: 'Quantum Core',
    description: 'Boosts hashing power per mining cycle.',
    category: 'mining',
    baseCost: 2500,
    costMultiplier: 1.8,
    currentLevel: 1,
    maxLevel: 15,
    benefitPerLevel: 0.005
  },
  {
    id: 'u3',
    name: 'Rapid Cooling',
    description: 'Accelerates energy regeneration rate when idle.',
    category: 'recharge',
    baseCost: 1500,
    costMultiplier: 1.6,
    currentLevel: 1,
    maxLevel: 10,
    benefitPerLevel: 2
  },
  {
    id: 'u4',
    name: 'Auto-Sync Bot',
    description: 'Background mining that works even when you sleep.',
    category: 'passive',
    baseCost: 10000,
    costMultiplier: 2.5,
    currentLevel: 0,
    maxLevel: 5,
    benefitPerLevel: 0.1
  }
];

export const LEADERBOARD_DATA: LeaderboardEntry[] = [
  { rank: 1, username: "Satoshi_N", balance: 1450230.55, blocksMined: 1240, topStreak: 45, seasonPeakRank: 1, referrals: 450 },
  { rank: 2, username: "Vitalik_B", balance: 980400.12, blocksMined: 980, topStreak: 12, seasonPeakRank: 2, referrals: 320 },
  { rank: 3, username: "Cz_Binance", balance: 875100.00, blocksMined: 850, topStreak: 5, seasonPeakRank: 1, referrals: 280 },
  { rank: 32193, username: "You", balance: 1234.56, isCurrentUser: true, blocksMined: 12, topStreak: 1, seasonPeakRank: 5, referrals: 3 },
];

export const FRIENDS_DATA: Friend[] = [
  { id: '1', username: "Alice_Wonder", joinedDate: "Oct 12, 2023", totalBalance: 45000, earnedForYou: 4500 },
  { id: '2', username: "Bob_Builder", joinedDate: "Nov 01, 2023", totalBalance: 12000, earnedForYou: 1200 },
];

export const TASKS_DATA: Task[] = [
  { 
    id: 't1', 
    type: 'social',
    title: 'Protocol Initiation', 
    description: 'Join the official secure broadcast channel for updates.',
    reward: 5000, 
    icon: 'send', 
    isCompleted: false,
    actionUrl: 'https://t.me/purexprotocol',
    buttonLabel: 'Join Channel'
  },
  { 
    id: 't2', 
    type: 'social',
    title: 'Neural Link X', 
    description: 'Follow the protocol architect on X (Twitter).',
    reward: 7500, 
    icon: 'twitter', 
    isCompleted: false,
    actionUrl: 'https://twitter.com/purexprotocol',
    buttonLabel: 'Follow X'
  },
  { 
    id: 't3', 
    type: 'referral',
    title: 'Network Expansion', 
    description: 'Invite 3 active operators to the grid.',
    reward: 25000, 
    icon: 'users', 
    isCompleted: false,
    currentProgress: 2, // Dynamic calculation logic will override this in EarnTab
    targetProgress: 3,
    buttonLabel: 'Invite Operators'
  },
  { 
    id: 't4', 
    type: 'wallet',
    title: 'Wallet Synchronization', 
    description: 'Link your non-custodial TON wallet for rewards.',
    reward: 50000, 
    icon: 'wallet', 
    isCompleted: true, // Example of completed task
    buttonLabel: 'Connect TON'
  },
];

export const RECENT_BLOCKS: MinedBlock[] = [
  { id: 'b1', finder: 'User_9921', hash: '0000...ae3f', difficulty: '42.5T', reward: 25.5, participants: 4, timestamp: '2s ago' },
  { id: 'b2', finder: 'Miner_X', hash: '0000...1b2a', difficulty: '38.2T', reward: 12.0, participants: 1, timestamp: '15s ago' },
];

export const NOTIFICATIONS: NotificationItem[] = [
  { id: '1', title: 'System Update 2.0', message: 'New mining protocols installed.', date: 'Today', read: false },
];
