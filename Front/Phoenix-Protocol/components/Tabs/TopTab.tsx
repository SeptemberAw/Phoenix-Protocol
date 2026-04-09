import React, { useState, useMemo, useEffect } from 'react';
import { Trophy, Award, Crown, ChevronRight, Info, Zap, Box, Users, Target, Calendar, Clock, Globe, Radio, Sparkles, ChevronDown } from 'lucide-react';
import { LeaderboardEntry } from '../../types';
import { LeagueInfoModal } from '../UI/LeagueInfoModal';
import { fetchLeaderboard, ApiLeaderboardEntry } from '../../api';
import { formatBalanceCompact } from '../../utils/formatBalance';
import { getLeague, getLeagueProgress, getNextLeague } from '../../utils/getLeague';

// Blocks mined formula: sqrt(balance / 10)
function calcBlocksMined(bal: number): number {
  if (bal <= 0) return 0;
  return Math.floor(Math.sqrt(bal / 10));
}

interface TopTabProps {
  onOpenUser: (user: LeaderboardEntry) => void;
  balance: number;
  networth?: number;
  rank: number;
  monthRank: number;
  weekEarned?: number;
  monthEarned?: number;
  peakWeekRank?: number;
  peakMonthRank?: number;
  peakAllTimeRank?: number;
}

export const TopTab: React.FC<TopTabProps> = ({ onOpenUser, balance, networth = 0, rank, monthRank, weekEarned = 0, monthEarned = 0, peakWeekRank = 0, peakMonthRank = 0, peakAllTimeRank = 0 }) => {
  const [filter, setFilter] = useState<'week' | 'month' | 'all'>('week');
  const [isLeagueModalOpen, setIsLeagueModalOpen] = useState(false);
  const [apiEntries, setApiEntries] = useState<ApiLeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number>(rank);
  const [myMonthRank, setMyMonthRank] = useState<number>(monthRank);
  const [myAllTimeRank, setMyAllTimeRank] = useState<number>(0);
  const [myWeekRank, setMyWeekRank] = useState<number>(0);
  const [myScore, setMyScore] = useState<number>(0);
  const [myWeekScore, setMyWeekScore] = useState<number>(weekEarned);
  const [myMonthScore, setMyMonthScore] = useState<number>(monthEarned);
  const [myNetworth, setMyNetworth] = useState<number>(networth);
  const [myPeakWeekRank, setMyPeakWeekRank] = useState<number>(peakWeekRank);
  const [myPeakMonthRank, setMyPeakMonthRank] = useState<number>(peakMonthRank);
  const [myPeakAllTimeRank, setMyPeakAllTimeRank] = useState<number>(peakAllTimeRank);
  const [myReferralCount, setMyReferralCount] = useState<number>(0);
  const [myMiningPower, setMyMiningPower] = useState<number>(0);

  // Sync from props
  useEffect(() => { if (rank > 0) setMyRank(rank); }, [rank]);
  useEffect(() => { if (monthRank > 0) setMyMonthRank(monthRank); }, [monthRank]);
  useEffect(() => { if (networth > 0) setMyNetworth(networth); }, [networth]);
  useEffect(() => { if (weekEarned > 0) setMyWeekScore(weekEarned); }, [weekEarned]);
  useEffect(() => { if (monthEarned > 0) setMyMonthScore(monthEarned); }, [monthEarned]);
  useEffect(() => { if (peakWeekRank > 0) setMyPeakWeekRank(peakWeekRank); }, [peakWeekRank]);
  useEffect(() => { if (peakMonthRank > 0) setMyPeakMonthRank(peakMonthRank); }, [peakMonthRank]);
  useEffect(() => { if (peakAllTimeRank > 0) setMyPeakAllTimeRank(peakAllTimeRank); }, [peakAllTimeRank]);

  // Fetch leaderboard on mount and when filter changes
  useEffect(() => {
    const load = () => {
      fetchLeaderboard(30, 0, filter).then(res => {
        if (res) {
          setApiEntries(res.leaderboard);
          if (res.my_rank != null && res.my_rank > 0) setMyRank(res.my_rank);
          if (res.my_week_rank > 0) setMyWeekRank(res.my_week_rank);
          if (res.my_month_rank > 0) setMyMonthRank(res.my_month_rank);
          if (res.my_all_time_rank > 0) setMyAllTimeRank(res.my_all_time_rank);
          if (res.my_score != null) setMyScore(Math.max(0, res.my_score));
          if (res.my_week_score != null) setMyWeekScore(Math.max(0, res.my_week_score));
          if (res.my_month_score != null) setMyMonthScore(Math.max(0, res.my_month_score));
          if (res.my_networth != null) setMyNetworth(Math.max(0, res.my_networth));
          if (res.my_peak_week_rank > 0) setMyPeakWeekRank(res.my_peak_week_rank);
          if (res.my_peak_month_rank > 0) setMyPeakMonthRank(res.my_peak_month_rank);
          if (res.my_peak_all_time_rank > 0) setMyPeakAllTimeRank(res.my_peak_all_time_rank);
          if (res.my_referral_count != null) setMyReferralCount(res.my_referral_count);
          if (res.my_mining_power != null) setMyMiningPower(res.my_mining_power);
        }
      }).catch(() => {});
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [filter]);

  // Map API entries to LeaderboardEntry
  const topThirty = useMemo((): LeaderboardEntry[] =>
    apiEntries.map((e): LeaderboardEntry => ({
      rank: e.rank,
      username: e.username,
      balance: Math.max(0, e.balance),
      isCurrentUser: e.is_current_user,
      generation: e.generation,
      blocksMined: calcBlocksMined(e.networth || e.balance),
      topStreak: 0,
      seasonPeakRank: e.rank,
      referrals: e.referral_count || 0,
      networth: Math.max(0, e.networth || 0),
      weekEarned: Math.max(0, e.week_earned || 0),
      monthEarned: Math.max(0, e.month_earned || 0),
      lifetimeBalance: Math.max(0, e.networth || e.lifetime_balance || 0),
      hashRate: e.mining_power || 0,
    })),
  [apiEntries]);

  // Current user card
  const currentUserEntry: LeaderboardEntry = useMemo(() => ({
    rank: myRank || 0,
    username: 'You',
    balance: myScore,
    isCurrentUser: true,
    blocksMined: calcBlocksMined(myNetworth),
    topStreak: 0,
    seasonPeakRank: myMonthRank || 0,
    referrals: myReferralCount,
    networth: Math.max(0, myNetworth),
    weekEarned: Math.max(0, myWeekScore),
    monthEarned: Math.max(0, myMonthScore),
    lifetimeBalance: Math.max(0, myNetworth),
    hashRate: myMiningPower,
    peakWeekRank: myPeakWeekRank,
    peakMonthRank: myPeakMonthRank,
    peakAllTimeRank: myPeakAllTimeRank,
  }), [myScore, myRank, myMonthRank, myWeekScore, myMonthScore, myNetworth, myReferralCount, myMiningPower, myPeakWeekRank, myPeakMonthRank, myPeakAllTimeRank]);

  // League ALWAYS based on monthly rank
  const leagueInfo = useMemo(() => getLeague(myMonthRank), [myMonthRank]);
  const progress = useMemo(() => getLeagueProgress(myMonthRank), [myMonthRank]);
  const nextLeague = useMemo(() => getNextLeague(myMonthRank), [myMonthRank]);

  return (
    <div className="flex flex-col w-full pt-2 gap-3 pb-24">
      
      {/* 1. League Progress Card */}
      <div 
        onClick={() => setIsLeagueModalOpen(true)}
        className="bg-[#0A0A0A] rounded-[28px] border border-[#222] p-5 relative overflow-hidden group cursor-pointer hover:border-primary/40 active:scale-[0.98] transition-all shadow-hard"
      >
          <div className="absolute right-0 top-0 opacity-5 group-hover:opacity-10 transition-opacity -translate-y-4">
              <Award size={120} />
          </div>
          
          <div className="relative z-10 flex flex-col gap-5">
              <div className="flex justify-between items-start">
                  <div>
                      <div className="flex items-center gap-2 mb-1">
                          <Radio size={10} className="text-primary animate-pulse" />
                          <span className="text-[9px] font-mono text-[#555] uppercase tracking-widest font-black">Operator Authorization</span>
                      </div>
                      <h2 className="text-3xl font-black text-white leading-none font-sans uppercase flex items-center gap-2">
                          {leagueInfo.name}
                          <Info size={14} className="text-[#333] group-hover:text-primary transition-colors" />
                      </h2>
                      <div className="mt-3 inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg">
                          <Zap size={10} className="text-primary fill-primary" />
                          <span className="text-[10px] font-mono font-black text-primary uppercase tracking-tighter">x{leagueInfo.multiplier.toFixed(1)} Yield Boost</span>
                      </div>
                  </div>
                  <div className="text-right">
                       <span className="text-[9px] font-mono text-[#444] uppercase block mb-1 font-black">Global Pos</span>
                       <div className="text-3xl font-bold text-white font-mono leading-none tracking-tighter">
                          #{myMonthRank || '—'}
                       </div>
                  </div>
              </div>
              
              {/* League Progress Bar */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[9px] font-mono text-[#555] uppercase font-black">
                  <div className="flex items-center gap-2">
                    <Target size={10} className="text-primary"/> 
                    <span>{leagueInfo.name} League</span>
                  </div>
                  {nextLeague && (
                    <span className="text-[8px] text-primary/60">Next: {nextLeague.name} (#{nextLeague.maxRank})</span>
                  )}
                </div>
                <div className="w-full h-1.5 bg-[#111] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(2, progress * 100)}%` }}
                  />
                </div>
              </div>
          </div>
      </div>

      {/* 2. Personal Standing Terminal */}
      <div 
        onClick={() => onOpenUser(currentUserEntry)}
        className="bg-[#111] bg-gradient-to-r from-primary/[0.03] to-transparent border border-primary/20 rounded-[24px] p-4 flex items-center justify-between relative overflow-hidden group active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(255,59,0,0.12)]"
      >
          <div className="absolute inset-0 bg-noise opacity-[0.03] pointer-events-none"></div>
          <div className="absolute top-0 left-0 w-32 h-full bg-gradient-to-r from-primary/10 to-transparent opacity-30"></div>
          
          <div className="flex items-center gap-4 relative z-10 flex-1 min-w-0">
              <div className="w-10 h-10 shrink-0 bg-primary/15 border border-primary/30 rounded-xl flex items-center justify-center text-primary shadow-[0_0_10px_rgba(255,59,0,0.2)]">
                  <span className="text-[10px] font-mono font-black leading-none text-center">
                    #{myRank || '—'}
                  </span>
              </div>
              <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black text-white uppercase tracking-tight truncate">Your Session Stats</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0"></div>
                    <span className="text-[9px] font-mono text-primary/70 uppercase font-bold tracking-widest truncate">
                      {filter.toUpperCase()}_RANKING_SYNC
                    </span>
                  </div>
              </div>
          </div>
          <div className="text-right relative z-10 shrink-0 ml-2">
              <div className="text-lg font-mono font-black text-white tracking-tighter leading-none drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                  {formatBalanceCompact(myScore || balance)}
              </div>
              <div className="text-[8px] text-[#444] font-mono font-black uppercase tracking-widest leading-none mt-0.5">PUREX</div>
              <div className="mt-1 inline-flex items-center justify-end">
                <span className="text-[7px] text-primary/60 font-mono font-black uppercase tracking-wider px-1.5 py-0.5 bg-primary/10 rounded border border-primary/20">
                  {filter === 'week' ? 'THIS WEEK' : filter === 'month' ? 'THIS MONTH' : 'ALL TIME'}
                </span>
              </div>
          </div>
      </div>

      <LeagueInfoModal 
        isOpen={isLeagueModalOpen} 
        onClose={() => setIsLeagueModalOpen(false)} 
        currentLeague={leagueInfo.name}
      />

      {/* 3. Sorting Tabs */}
      <div className="flex p-1 bg-[#0F0F0F] rounded-2xl border border-[#222] mt-1 sticky top-0 z-20 backdrop-blur-xl shadow-xl">
        {[
            { id: 'week', label: 'Weekly', icon: Clock },
            { id: 'month', label: 'Monthly', icon: Calendar },
            { id: 'all', label: 'All Time', icon: Globe }
        ].map((t) => (
            <button
                key={t.id}
                onClick={() => setFilter(t.id as any)}
                className={`
                    flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-mono font-black uppercase transition-all
                    ${filter === t.id 
                        ? 'bg-primary text-black shadow-glow-orange' 
                        : 'text-[#444] hover:text-white'}
                `}
            >
                <t.icon size={12} />
                {t.label}
            </button>
        ))}
      </div>

      {/* 4. Leaderboard List */}
      <div className="flex flex-col gap-1.5 mt-2">
        <div className="flex items-center justify-between px-2 mb-2">
            <div className="flex items-center gap-2">
                <Sparkles size={12} className="text-primary" />
                <span className="text-[10px] font-mono text-[#333] font-black uppercase tracking-[0.2em]">Top_Performers_30</span>
            </div>
            <div className="flex-1 mx-4 h-[1px] bg-[#111]"></div>
        </div>

        {topThirty.map((entry, index) => {
            const isTop3 = index < 3;
            const isMe = entry.isCurrentUser;
            // Always show period score consistently for all rows
            const displayBalance = entry.balance;
            
            return (
                <div 
                key={`leader-${filter}-${entry.username}-${index}`}
                onClick={() => onOpenUser({ ...entry, balance: entry.lifetimeBalance ?? entry.balance })}
                className={`
                    group relative flex items-center justify-between p-4 rounded-[20px] border transition-all cursor-pointer active:scale-[0.99] animate-scale-up
                    ${isMe 
                        ? 'bg-primary/10 border-primary shadow-[0_0_20px_rgba(255,59,0,0.1)]' 
                        : isTop3 
                            ? 'bg-[#0D0D0D] border-[#1A1A1A] shadow-lg'
                            : 'bg-transparent border-transparent border-b-[#111] hover:bg-white/[0.02]'}
                `}
                >
                    <div className="flex items-center gap-4 flex-1 min-w-0 mr-2">
                        <div className={`
                            w-9 h-9 shrink-0 flex items-center justify-center rounded-xl font-mono font-black text-xs relative
                            ${isMe ? 'bg-primary text-black border-none' : isTop3 ? 'bg-[#161616] text-white border border-[#333]' : 'text-[#333]'}
                        `}>
                            {index === 0 && <Crown size={14} className="absolute -top-2 -left-2 text-yellow-500 -rotate-12 drop-shadow-glow" fill="currentColor" />}
                            {entry.rank}
                        </div>
                        
                        <div className="flex flex-col min-w-0">
                            <span className={`text-[14px] font-black uppercase tracking-tight flex items-center gap-2 ${isMe ? 'text-primary' : 'text-gray-200'}`}>
                                <span className="truncate">{isMe ? "YOU" : String(entry.username)}</span>
                                {isMe && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0"></div>}
                            </span>
                            <div className="flex items-center gap-3 mt-1 opacity-40">
                                <div className="flex items-center gap-1 text-[8px] font-mono text-white font-bold uppercase shrink-0">
                                    <Box size={9} className="text-primary"/> {String(entry.blocksMined)}
                                </div>
                                <div className="w-[1px] h-2 bg-[#222] shrink-0"></div>
                                <div className="flex items-center gap-1 text-[8px] font-mono text-white font-bold uppercase shrink-0">
                                    <Users size={9} className="text-primary"/> {String(entry.referrals)}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="text-right shrink-0 ml-2">
                        <div className={`text-sm font-mono font-black tracking-tighter ${isMe ? 'text-primary' : 'text-white'}`}>
                            {formatBalanceCompact(displayBalance || 0)}
                        </div>
                        <div className="text-[8px] text-[#444] font-mono font-black uppercase tracking-widest">PUREX</div>
                    </div>
                </div>
            );
        })}
      </div>

      <div className="mt-8 p-10 border-t border-[#111] flex flex-col items-center justify-center text-center opacity-40">
          <Radio size={24} className="text-[#333] mb-3 animate-pulse" />
          <p className="text-[9px] font-mono text-[#444] uppercase font-black leading-tight tracking-[0.2em]">
            Protocols Synchronized.<br/>Full leaderboard updated.
          </p>
      </div>
    </div>
  );
};
