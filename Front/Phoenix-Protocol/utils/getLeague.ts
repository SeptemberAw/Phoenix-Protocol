import { Crown, Award, Shield, Target, Zap, Trophy } from 'lucide-react';

export interface LeagueInfo {
  name: string;
  color: string;
  border: string;
  bg: string;
  icon: typeof Crown;
  multiplier: number;
  minRank: number;
  maxRank: number;
}

// Must match LeagueInfoModal LEAGUES exactly
const LEAGUE_TIERS: LeagueInfo[] = [
  { name: 'Master',   minRank: 1,    maxRank: 10,    multiplier: 3.0,  icon: Crown,  color: 'text-yellow-500',  border: 'border-yellow-500/20', bg: 'bg-yellow-500/5' },
  { name: 'Diamond',  minRank: 11,   maxRank: 100,   multiplier: 2.0,  icon: Award,  color: 'text-blue-400',    border: 'border-blue-400/20',   bg: 'bg-blue-400/5' },
  { name: 'Platinum', minRank: 101,  maxRank: 500,   multiplier: 1.5,  icon: Shield, color: 'text-indigo-400',  border: 'border-indigo-400/20', bg: 'bg-indigo-400/5' },
  { name: 'Gold',     minRank: 501,  maxRank: 1000,  multiplier: 1.25, icon: Target, color: 'text-orange-400',  border: 'border-orange-400/20', bg: 'bg-orange-400/5' },
  { name: 'Silver',   minRank: 1001, maxRank: 5000,  multiplier: 1.1,  icon: Zap,    color: 'text-gray-300',    border: 'border-gray-300/20',   bg: 'bg-gray-300/5' },
  { name: 'Bronze',   minRank: 5001, maxRank: Infinity, multiplier: 1.0, icon: Trophy, color: 'text-amber-700', border: 'border-amber-700/20',  bg: 'bg-amber-700/5' },
];

const BRONZE = LEAGUE_TIERS[LEAGUE_TIERS.length - 1];

export function getLeague(rank: number): LeagueInfo {
  if (!rank || rank <= 0) return BRONZE;
  return LEAGUE_TIERS.find(t => rank >= t.minRank && rank <= t.maxRank) || BRONZE;
}

// Progress within current league tier (0..1)
export function getLeagueProgress(rank: number): number {
  const league = getLeague(rank);
  if (!rank || rank <= 0) return 0;
  if (league.minRank === 1 && rank <= league.maxRank) {
    // Master tier: rank 1 = 100%, rank 10 = ~10%
    return 1 - (rank - 1) / Math.max(1, league.maxRank - league.minRank);
  }
  // Other tiers: lower rank = more progress
  const range = league.maxRank - league.minRank;
  return 1 - (rank - league.minRank) / Math.max(1, range);
}

// Next league to promote into (or null if Master)
export function getNextLeague(rank: number): LeagueInfo | null {
  const current = getLeague(rank);
  const idx = LEAGUE_TIERS.indexOf(current);
  return idx > 0 ? LEAGUE_TIERS[idx - 1] : null;
}
