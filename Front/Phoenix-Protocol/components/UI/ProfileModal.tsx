
import React, { useMemo, useState } from 'react';
import { X, Shield, Globe, Crown, Award, Target, Zap, TrendingUp, TrendingDown, Clock, Calendar, Users, Layers, Star, BarChart, ChevronDown, Activity, FastForward, Focus, MessageCircle } from 'lucide-react';
import { getLeague } from '../../utils/getLeague';
import { formatBalanceCompact } from '../../utils/formatBalance';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  balance: number;
  networth?: number;
  weekEarned?: number;
  monthEarned?: number;
  generation: number;
  isPublic?: boolean;
  rank?: number;
  weekRank?: number;
  monthRank?: number;
  allTimeRank?: number;
  peakWeekRank?: number;
  peakMonthRank?: number;
  peakAllTimeRank?: number;
  referrals?: number;
  hashRate?: number;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ 
  isOpen, onClose, username, balance, networth, weekEarned = 0, monthEarned = 0, generation, isPublic = false,
  rank = 0, weekRank = 0, monthRank = 0, allTimeRank = 0,
  peakWeekRank = 0, peakMonthRank = 0, peakAllTimeRank = 0,
  referrals = 0, hashRate = 0
}) => {
  const [showPeakStats, setShowPeakStats] = useState(false);
  
  // Always show networth as the main balance — never the period-changing score
  const totalMined = Math.max(0, networth ?? balance);
  const romanGen = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"][generation - 1] || "I";

  // Smart Balance Formatter — never show negative
  const { displayBalance, balanceFontSize } = useMemo(() => {
    const val = Math.max(0, totalMined);
    if (val >= 1e15) return { displayBalance: (val / 1e15).toFixed(2) + 'Q', balanceFontSize: 'text-5xl' };
    if (val >= 1e12) return { displayBalance: (val / 1e12).toFixed(2) + 'T', balanceFontSize: 'text-5xl' };
    if (val >= 1e9) return { displayBalance: (val / 1e9).toFixed(2) + 'B', balanceFontSize: 'text-5xl' };
    if (val >= 1e6) return { displayBalance: (val / 1e6).toFixed(2) + 'M', balanceFontSize: 'text-5xl' };

    const fullString = new Intl.NumberFormat('en-US').format(Math.floor(val));
    const length = fullString.length;
    let size = 'text-5xl';
    if (length > 10) size = 'text-4xl';
    if (length > 13) size = 'text-3xl';
    return { displayBalance: fullString, balanceFontSize: size };
  }, [totalMined]);

  const analyticsData = useMemo(() => {
    const rate = hashRate > 0 ? hashRate : 0.005 * Math.pow(1.5, generation - 1);
    const myHashRate = rate >= 1 ? rate.toFixed(1) : rate.toFixed(4);
    return {
      isPositive: true,
      newNodesWeek: referrals,
      myHashRate
    };
  }, [referrals, generation, hashRate]);

  const liveRanks = useMemo(() => ({
    weekRank: weekRank || rank || 0,
    monthRank: monthRank || rank || 0,
    globalRank: allTimeRank || rank || 0,
  }), [rank, weekRank, monthRank, allTimeRank]);

  const peakRanks = useMemo(() => ({
    weekRank: peakWeekRank || weekRank || rank || 0,
    monthRank: peakMonthRank || monthRank || rank || 0,
    globalRank: peakAllTimeRank || allTimeRank || rank || 0,
  }), [peakWeekRank, peakMonthRank, peakAllTimeRank, weekRank, monthRank, allTimeRank, rank]);

  const rankingStats = showPeakStats ? peakRanks : liveRanks;

  const hasPeakData = peakWeekRank > 0 || peakMonthRank > 0 || peakAllTimeRank > 0;
  const hasEarnedBreakdown = weekEarned > 0 || monthEarned > 0 || totalMined > 0;

  const league = useMemo(() => {
    const info = getLeague(monthRank || rank || 0);
    return { name: info.name.toUpperCase(), color: info.color, border: info.border, bg: info.bg, icon: info.icon };
  }, [monthRank, rank]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/98 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-sm bg-[#080808] border-t sm:border border-white/10 rounded-t-[40px] sm:rounded-[40px] overflow-hidden flex flex-col p-8 animate-scale-up shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="absolute inset-0 bg-noise opacity-[0.03] pointer-events-none"></div>
        
        {/* IDENTITY HEADER */}
        <div className="flex justify-between items-start mb-8 shrink-0 gap-4">
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 text-white/20">
               <span className="text-[7px] font-mono font-black uppercase tracking-[0.4em]">Protocol_ID_v3</span>
               <div className="h-[1px] w-4 bg-white/10"></div>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tighter leading-none mb-4 truncate w-full">
                {username}
            </h2>
            
            <div className="flex items-center gap-2">
                <div className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg flex items-center shrink-0">
                    <span className="text-[8px] font-mono text-white/40 font-black uppercase tracking-widest">Gen_{romanGen}</span>
                </div>
                <div className={`px-2.5 py-1 ${league.bg} border ${league.border} rounded-lg flex items-center gap-1.5 shrink-0`}>
                    <league.icon size={10} className={league.color} />
                    <span className={`text-[8px] font-mono font-black uppercase tracking-[0.15em] ${league.color}`}>
                        {league.name}
                    </span>
                </div>
            </div>
          </div>
          
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/20 hover:text-white transition-all active:scale-90 shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* DATA FIELD */}
        <div className="flex flex-col space-y-8 pb-2">
          
          {/* NETWORTH BLOCK — always shows networth, never period score */}
          <div className="flex flex-col w-full">
            <span className="text-[8px] font-mono text-white/20 uppercase font-black tracking-[0.4em] mb-2 text-primary/60">Extraction_Networth</span>
            <div className="flex items-baseline gap-1.5 w-full overflow-hidden">
              <span className={`${balanceFontSize} font-mono font-black text-white tracking-tighter leading-none drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] whitespace-nowrap transition-all duration-300`}>
                {displayBalance}
              </span>
              <span className="text-xs font-mono font-black text-primary tracking-widest uppercase mb-1">PUREX</span>
            </div>
          </div>

          {/* TEMPORAL RANKING */}
          <div className="flex flex-col gap-4 py-5 border-y border-white/5">
             <div className="flex justify-between items-center">
                <span className="text-[8px] font-mono text-white/20 uppercase font-black tracking-[0.3em]">Ranking_Sync</span>
                <button 
                    onClick={() => setShowPeakStats(!showPeakStats)}
                    className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border active:scale-95 transition-all cursor-pointer ${
                      showPeakStats 
                        ? 'bg-cyan-400/10 border-cyan-400/25 shadow-[0_0_8px_rgba(34,211,238,0.12)]' 
                        : 'bg-white/5 border-white/10 hover:border-primary/30'
                    }`}
                >
                    {showPeakStats ? (
                      <>
                        <FastForward size={8} className="text-cyan-400" />
                        <span className="text-[7px] font-mono font-black uppercase tracking-widest text-cyan-400">Peak</span>
                      </>
                    ) : (
                      <>
                        <Activity size={8} className="text-primary animate-pulse" />
                        <span className="text-[7px] font-mono font-black uppercase tracking-widest text-white/40">Live</span>
                      </>
                    )}
                </button>
             </div>

             <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-white/20">
                      <Clock size={10} />
                      <span className="text-[7px] font-mono font-black uppercase tracking-widest">7D</span>
                    </div>
                    <span className={`text-lg font-mono font-black leading-none tracking-tighter transition-colors ${
                      showPeakStats ? 'text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.5)]' : 'text-white'
                    }`}>
                      {rankingStats.weekRank > 0 ? `#${new Intl.NumberFormat('en-US').format(rankingStats.weekRank)}` : '—'}
                    </span>
                </div>
                <div className="flex flex-col gap-1 items-center border-x border-white/5 px-2">
                    <div className="flex items-center gap-1.5 text-white/20">
                      <Calendar size={10} />
                      <span className="text-[7px] font-mono font-black uppercase tracking-widest">30D</span>
                    </div>
                    <span className={`text-lg font-mono font-black leading-none tracking-tighter transition-colors ${
                      showPeakStats ? 'text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.5)]' : 'text-white'
                    }`}>
                      {rankingStats.monthRank > 0 ? `#${new Intl.NumberFormat('en-US').format(rankingStats.monthRank)}` : '—'}
                    </span>
                </div>
                <div className="flex flex-col gap-1 items-end">
                    <div className="flex items-center gap-1.5 text-white/20">
                      <Globe size={10} />
                      <span className="text-[7px] font-mono font-black uppercase tracking-widest">ALL</span>
                    </div>
                    <span className={`text-lg font-mono font-black leading-none tracking-tighter transition-colors ${
                      showPeakStats ? 'text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.5)]' : 'text-primary'
                    }`}>
                      {rankingStats.globalRank > 0 ? `#${new Intl.NumberFormat('en-US').format(rankingStats.globalRank)}` : '—'}
                    </span>
                </div>
             </div>

             {/* Earned breakdown — compact inline row */}
             {hasEarnedBreakdown && (
               <div className="mt-1 pt-3 border-t border-white/5">
                 <div className="flex items-center gap-3">
                   <div className="flex-1 flex flex-col gap-0.5">
                     <div className="flex items-center gap-1 text-white/20">
                       <Calendar size={8} />
                       <span className="text-[6px] font-mono font-black uppercase tracking-widest">Monthly</span>
                     </div>
                     <span className="text-base font-mono font-black text-white/70 tracking-tighter leading-none">
                       {formatBalanceCompact(monthEarned)}
                     </span>
                   </div>
                   <div className="w-px h-7 bg-white/5 shrink-0" />
                   <div className="flex-1 flex flex-col gap-0.5">
                     <div className="flex items-center gap-1 text-white/20">
                       <Clock size={8} />
                       <span className="text-[6px] font-mono font-black uppercase tracking-widest">Weekly</span>
                     </div>
                     <span className="text-base font-mono font-black text-white/40 tracking-tighter leading-none">
                       {formatBalanceCompact(weekEarned)}
                     </span>
                   </div>
                 </div>
               </div>
             )}
          </div>

          {/* DATA GRID */}
          <div className="space-y-4">
             <div className="flex items-center justify-between mb-2">
                <span className="text-[8px] font-mono text-white/20 uppercase font-black tracking-[0.3em]">Core_Analytics</span>
                <div className="h-[1px] flex-1 ml-4 bg-white/5"></div>
             </div>

             <div className="flex items-center justify-between group py-2 border-b border-white/[0.02]">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center text-white/20 group-hover:text-primary transition-colors">
                      <Users size={14} />
                   </div>
                   <div className="flex flex-col">
                     <span className="text-[9px] font-mono text-white/40 uppercase font-black tracking-widest">Linked_Nodes</span>
                   </div>
                </div>
                <div className="flex items-baseline gap-1.5 font-mono font-black tracking-tighter">
                   <span className="text-base text-white">{referrals}</span>
                </div>
             </div>

             <div className="flex items-center justify-between group py-2">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center text-white/20 group-hover:text-primary transition-colors">
                      {analyticsData.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                   </div>
                   <div className="flex flex-col">
                     <span className="text-[9px] font-mono text-white/40 uppercase font-black tracking-widest">Hash_Rate</span>
                   </div>
                </div>
                <span className="text-base font-mono font-black tracking-tighter text-white/40">
                   {analyticsData.myHashRate} CH/s
                </span>
             </div>
          </div>

          {/* PUBLIC UPLINK SECTION */}
          {isPublic && (
             <div className="pt-6 border-t border-white/5">
                 <button 
                    onClick={() => window.open(`https://t.me/${username}`, '_blank')}
                    className="w-full h-14 bg-white text-black rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-glow-white hover:bg-gray-200"
                 >
                    <MessageCircle size={16} className="text-black" />
                    <span className="tracking-widest">Establish Neural Uplink</span>
                 </button>
             </div>
          )}

          {/* DYNAMIC COMPARISON FOOTER */}
          {!isPublic && (
            <div className="pt-6 border-t border-white/5">
                <div className="w-full flex flex-col items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-white/[0.02] px-4 py-1.5 rounded-full border border-white/5">
                        <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-[7px] font-mono font-black text-white/40 uppercase tracking-[0.2em]">
                            Sync_State: Active_Node
                        </span>
                    </div>
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
