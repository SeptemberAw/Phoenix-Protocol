
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { pvpSearch, pvpResolve, ApiPublicProfile, ApiPvPResult, createInvoice, verifyPayment } from '../../api';
import { useTonPayment } from '../../hooks/useTonPayment';
import { 
  Swords, Zap, ShieldAlert, Target, ShieldCheck, 
  Lock, Wallet, Star, Terminal, ChevronRight, Activity, Binary, Search, Users, Gauge, Fingerprint, Crown, Award, Shield, Trophy, X, RefreshCw, Radar, Info, ChevronDown, Delete, CornerDownLeft, CheckCircle2, Timer, TrendingUp, Percent, Database, History, AlertTriangle, ShieldX, HardDrive, BarChart3, Globe, Flame, CreditCard, Skull, Dna
} from 'lucide-react';

interface FightsTabProps {
  balance: number;
  energy: number;
  fightsLeft: number;
  extraFights: number;
  generation: number;
  totalLevels: number;
  aggressorLevel: number;
  onlineCount: number;
  telegramId: number;
  onFight: (wager: number, isWin: boolean, serverBalance?: number, serverFightsLeft?: number) => void;
  onBuyFights: () => void;
  onSaveExtraction: (wager: number) => void;
}

const LEAGUES = [
  { name: 'Master', min: 1000000000, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20', icon: Crown },
  { name: 'Diamond', min: 500000000, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20', icon: Award },
  { name: 'Platinum', min: 100000000, color: 'text-indigo-400', bg: 'bg-indigo-400/10', border: 'border-indigo-400/20', icon: Shield },
  { name: 'Gold', min: 10000000, color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20', icon: Target },
  { name: 'Silver', min: 1000000, color: 'text-gray-300', bg: 'bg-white/5', border: 'border-white/10', icon: Trophy },
  { name: 'Bronze', min: 0, color: 'text-amber-700', bg: 'bg-amber-700/10', border: 'border-amber-700/20', icon: Trophy },
];

const getRoman = (n: number) => ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"][Math.floor(n) - 1] || "I";
const getGenInfo = (gen: number) => {
    if (gen >= 11) return { color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20' };
    if (gen >= 6) return { color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/20' };
    return { color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' };
};
const getLeague = (bal: number) => LEAGUES.find(l => bal >= l.min) || LEAGUES[5];

const formatSmart = (num: number) => {
  if (isNaN(num) || !isFinite(num)) return "0";
  if (num >= 1_000_000_000_000) return (num / 1_000_000_000_000).toFixed(2) + 'T';
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return Math.floor(num).toLocaleString('en-US');
};

export const FightsTab: React.FC<FightsTabProps> = ({ 
  balance, energy, fightsLeft, extraFights, generation, aggressorLevel, onlineCount, telegramId, onFight, onBuyFights, onSaveExtraction 
}) => {
  const { isWalletConnected, connectWallet, payWithTon, isProcessing: isTonProcessing, tonPrices, starsPrices } = useTonPayment();
  const isUnlocked = generation >= 3;
  const userLeague = useMemo(() => getLeague(balance), [balance]);
  
  const [wagerPct, setWagerPct] = useState(5);
  const [isNumpadOpen, setIsNumpadOpen] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [isRiskInfoOpen, setIsRiskInfoOpen] = useState(false);
  
  const [battleState, setBattleState] = useState<'idle' | 'searching' | 'versus' | 'battle' | 'result' | 'payment'>('idle');
  const [opponent, setOpponent] = useState<any>(null);
  const [result, setResult] = useState<'win' | 'loss' | null>(null);
  const [battleProgress, setBattleProgress] = useState(0);
  const [battleLogs, setBattleLogs] = useState<string[]>([]);
  
  const [isRecoveryMode, setIsRecoveryMode] = useState(false); // Toggle for displaying payment options
  const [isRecovering, setIsRecovering] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [maxWagerHint, setMaxWagerHint] = useState(false);

  // Auto-hide search error after 5s
  useEffect(() => {
    if (!searchError) return;
    const t = setTimeout(() => setSearchError(null), 5000);
    return () => clearTimeout(t);
  }, [searchError]);

  // Auto-hide max wager hint
  useEffect(() => {
    if (!maxWagerHint) return;
    const t = setTimeout(() => setMaxWagerHint(false), 2500);
    return () => clearTimeout(t);
  }, [maxWagerHint]);

  const maxWagerPercent = useMemo(() => Math.min(90, 5 + (generation - 1) * 9.5), [generation]);
  const maxPossibleWager = (balance * maxWagerPercent) / 100;
  
  const currentWager = useMemo(() => {
    if (manualInput) {
        const val = parseFloat(manualInput);
        if (isNaN(val)) return 0;
        return Math.min(val, maxPossibleWager);
    }
    return (balance * Math.min(wagerPct, maxWagerPercent)) / 100;
  }, [manualInput, wagerPct, balance, maxPossibleWager]);

  const networkTax = currentWager * 0.15;
  const potentialProfit = currentWager * 1.5 - networkTax;

  const [frozenWager, setFrozenWager] = useState(0);
  const [frozenTax, setFrozenTax] = useState(0);
  const [frozenYield, setFrozenYield] = useState(0);
  const [txHash, setTxHash] = useState("");

  const pvpResultRef = useRef<ApiPvPResult | null>(null);
  const realOpponentRef = useRef<ApiPublicProfile | null>(null);

  const startBattle = useCallback(async () => {
    setFrozenWager(currentWager);
    setFrozenTax(networkTax);
    setFrozenYield(potentialProfit);
    setBattleLogs([]);
    setBattleProgress(0);
    setIsRecoveryMode(false);
    setTxHash(`0x${Math.floor(Math.random()*16777215).toString(16).toUpperCase()}${Math.floor(Math.random()*16777215).toString(16).toUpperCase()}`);
    pvpResultRef.current = null;
    realOpponentRef.current = null;

    setBattleState('searching');

    // Real API: search for opponent
    const searchResult = await pvpSearch().catch(() => null);
    if (!searchResult || !searchResult.opponent) {
      setSearchError('No opponents found for this wager. Try lowering your stake.');
      setBattleState('idle');
      return;
    }
    setSearchError(null);

    const opp = searchResult.opponent;
    realOpponentRef.current = opp;
    const oppBalance = parseFloat(opp.balance);

    setOpponent({
      username: opp.username || `Node_${opp.telegram_id}`,
      league: getLeague(oppBalance),
      rank: opp.rank_score || Math.floor(Math.random() * 50000) + 1,
      networth: oppBalance,
      gen: opp.generation,
      winRate: (Math.random() * 20 + 45).toFixed(1),
      threat: opp.aggressor_level > 70 ? 'EXTREME' : opp.aggressor_level > 30 ? 'HIGH' : 'LOW',
    });
    setBattleState('versus');

    // Real API: resolve PvP (server determines outcome)
    const resolveResult = await pvpResolve(opp.telegram_id, currentWager).catch(() => null);
    pvpResultRef.current = resolveResult;

    // After versus display, start battle animation
    setTimeout(() => setBattleState('battle'), 3500);
  }, [currentWager, networkTax, potentialProfit, balance, generation]);

  const handleBattleEnd = useCallback((isWin: boolean) => {
    setResult(isWin ? 'win' : 'loss');
    setBattleState('result');

    const apiResult = pvpResultRef.current;
    if (apiResult) {
      onFight(
        frozenWager,
        apiResult.result === 'win',
        parseFloat(apiResult.new_balance),
        apiResult.fights_left,
      );
    } else {
      onFight(frozenWager, isWin);
    }
  }, [frozenWager, onFight]);

  const handleRechargeStars = async () => {
    setIsProcessingPayment(true);
    try {
      const { invoice_url } = await createInvoice('fight_refill');
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openInvoice) {
        tg.openInvoice(invoice_url, async (status: string) => {
          if (status === 'paid') {
            try {
              await verifyPayment('fight_refill');
              onBuyFights();
              setBattleState('idle');
            } catch { /* ignore */ }
          }
          setIsProcessingPayment(false);
        });
      } else {
        setIsProcessingPayment(false);
      }
    } catch {
      setIsProcessingPayment(false);
    }
  };

  const handleRechargeTon = async () => {
    if (!isWalletConnected) { connectWallet(); return; }
    setIsProcessingPayment(true);
    try {
      const result = await payWithTon('fight_refill', telegramId);
      if (result) {
        onBuyFights();
        setBattleState('idle');
      }
    } catch { /* ignore */ }
    setIsProcessingPayment(false);
  };

  useEffect(() => {
    if (battleState === 'battle') {
      // Use server-determined result if available, otherwise fallback
      const apiResult = pvpResultRef.current;
      const willWin = apiResult ? apiResult.result === 'win' : Math.random() > 0.45;
      const failPoint = willWin ? 100 : Math.floor(Math.random() * 30 + 60); // Fail later for drama
      
      const successLogs = [
        "Resolving Proxy...",
        "Handshake: OK",
        "Injecting Payload...",
        "Bypassing Firewall...",
        "Root Access: GRANTED",
        "Decrypting Keys...",
        "Transferring Assets..."
      ];
      
      const failLogs = [
        "Resolving Proxy...",
        "Handshake: OK",
        "Injecting Payload...",
        "Bypassing Firewall...",
        "HoneyPot Detected!",
        "Connection Refused.",
        "Packet Loss: 100%"
      ];

      const activeLogs = willWin ? successLogs : failLogs;
      
      const interval = setInterval(() => {
        setBattleProgress(prev => {
          const next = prev + 0.5; // Smoother increment

          // Log logic based on deterministic progress
          if (Math.floor(next) % 15 === 0 && Math.floor(next) !== Math.floor(prev)) {
            const index = Math.floor(next / 15) - 1;
            if (index >= 0 && index < activeLogs.length) {
              setBattleLogs(b => [activeLogs[index], ...b].slice(0, 4));
            }
          }

          if (willWin && next >= 100) { 
              clearInterval(interval); 
              handleBattleEnd(true); 
              return 100; 
          }
          
          if (!willWin && next >= failPoint) { 
              clearInterval(interval);
              setBattleLogs(b => ["CRITICAL: ACCESS DENIED", ...b].slice(0, 4));
              setTimeout(() => handleBattleEnd(false), 800); 
              return next; 
          }
          
          return next;
        });
      }, 20); // Faster tick rate for smoothness
      return () => clearInterval(interval);
    }
  }, [battleState, handleBattleEnd]);

  const handleNumpadKey = (key: string) => {
    if (key === 'del') setManualInput(prev => prev.slice(0, -1));
    else if (key === 'clear') { setManualInput(""); setWagerPct(5); }
    else if (key === '000' || key === '0') {
        if (manualInput === "" || manualInput === "0") return;
        if (manualInput.length + key.length > 15) return;
        setManualInput(prev => prev + key);
    } else if (key.includes('%')) {
        const pct = parseInt(key);
        const increment = (maxPossibleWager * pct) / 100;
        const newVal = Math.min(balance, (parseFloat(manualInput) || 0) + increment);
        setManualInput(Math.floor(newVal).toString());
    } else {
        if (manualInput.length >= 15) return;
        setManualInput(prev => prev + key);
    }
  };

  const performRecoveryStars = async () => {
    setIsRecovering(true);
    try {
      const { invoice_url } = await createInvoice('pvp_recovery');
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openInvoice) {
        tg.openInvoice(invoice_url, async (status: string) => {
          if (status === 'paid') {
            try {
              await verifyPayment('pvp_recovery');
              onSaveExtraction(frozenWager);
              setBattleState('idle');
            } catch { /* ignore */ }
          }
          setIsRecovering(false);
        });
      } else {
        setIsRecovering(false);
      }
    } catch {
      setIsRecovering(false);
    }
  };

  const performRecoveryTon = async () => {
    if (!isWalletConnected) { connectWallet(); return; }
    setIsRecovering(true);
    try {
      const result = await payWithTon('pvp_recovery', telegramId);
      if (result) {
        onSaveExtraction(frozenWager);
        setBattleState('idle');
      }
    } catch { /* ignore */ }
    setIsRecovering(false);
  };

  const isInputOverLimit = manualInput && parseFloat(manualInput) > maxPossibleWager;
  const isRechargeNeeded = fightsLeft + extraFights <= 0;

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-10 animate-scale-up">
        <div className="w-20 h-20 rounded-[32px] bg-black border border-primary/20 flex items-center justify-center text-primary shadow-glow-orange mb-6"><Lock size={32} /></div>
        <h2 className="text-xl font-black text-white uppercase italic mb-2 tracking-tighter">Neural Lock G3</h2>
        <p className="text-[9px] font-mono text-white/40 uppercase font-black leading-relaxed">Authorization G_III required for inter-node breaches.</p>
      </div>
    );
  }

  // Helper for gen colors
  const genInfo = getGenInfo(generation);

  return (
    <div className="flex flex-col w-full h-[calc(100vh-80px)] overflow-hidden relative">
      
      {/* Header Info Panel */}
      <div className="flex justify-between items-center px-5 py-3 bg-white/5 rounded-2xl border border-white/5 mx-5 backdrop-blur-md relative z-20 shrink-0 mt-3 mb-1">
         <div className="flex items-center gap-3">
             <div className="flex flex-col">
                 <span className="text-[7px] font-mono text-white/20 uppercase font-black tracking-widest">Protocol</span>
                 <span className={`text-[10px] font-mono font-black ${genInfo.color}`}>G_{getRoman(generation)}</span>
             </div>
             <div className="w-[1px] h-6 bg-white/5"></div>
             <div className="flex flex-col">
                 <span className="text-[7px] font-mono text-white/20 uppercase font-black tracking-widest">Network</span>
                 <div className="flex items-center gap-1">
                    <Users size={8} className="text-primary animate-pulse" />
                    <span className="text-[10px] font-mono font-black text-white">{onlineCount && onlineCount >= 1000 ? (onlineCount / 1000).toFixed(1) + 'K' : onlineCount || '--'}</span>
                 </div>
             </div>
         </div>
         <div 
            onClick={() => setIsRiskInfoOpen(!isRiskInfoOpen)}
            className="flex flex-col items-end cursor-pointer group"
         >
             <div className="flex items-center gap-1">
                <span className="text-[7px] font-mono text-white/20 uppercase font-black tracking-widest group-hover:text-primary transition-colors">Risk_Index</span>
                <Info size={8} className="text-white/20 group-hover:text-primary" />
             </div>
             <div className="flex items-center gap-1.5">
                 <div className={`w-1.5 h-1.5 rounded-full ${aggressorLevel > 70 ? 'bg-red-500 animate-ping' : aggressorLevel > 30 ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`}></div>
                 <span className={`text-[10px] font-mono font-black ${aggressorLevel > 70 ? 'text-red-500' : 'text-primary'}`}>
                    {aggressorLevel > 70 ? 'CRITICAL' : aggressorLevel > 30 ? 'HIGH' : 'STABLE'}
                 </span>
             </div>
             
             {/* Risk Spoiler */}
             {isRiskInfoOpen && (
                 <div className="absolute top-14 right-0 w-52 bg-[#0A0A0A] border border-primary/20 p-4 rounded-xl shadow-2xl animate-scale-up z-50">
                    <div className="flex items-center gap-2 mb-2 text-primary">
                        <AlertTriangle size={12} />
                        <span className="text-[9px] font-black uppercase tracking-wider">Visibility Index</span>
                    </div>
                    <p className="text-[9px] font-mono text-[#AAA] leading-relaxed">
                        Shows your visibility to other operators.
                        <br/><br/>
                        The higher the index — the more likely you are to be attacked.
                        <br/><br/>
                        <span className="text-white">Daily reset: 00:00 UTC.</span>
                    </p>
                 </div>
             )}
         </div>
      </div>

      {/* Main Control Card Wrapper - Left Align + Start Align + No Gap */}
      <div className="flex-1 flex flex-col items-center px-5 pt-1 pb-24 min-h-0">
          <div className="w-full flex-1 bg-[#0D0D0D] rounded-[40px] border border-[#1A1A1A] p-4 relative shadow-hard flex flex-col gap-4">
            <div className="absolute inset-0 bg-noise opacity-10 pointer-events-none"></div>

            {/* Risk Visualizer (Top) */}
            <div className="w-full flex flex-col gap-1.5 z-10 shrink-0">
                <div className="flex justify-between items-center">
                    <span className="text-[8px] font-mono text-[#444] uppercase font-black tracking-[0.2em]">Risk_Saturation</span>
                    <span className="text-[10px] font-mono text-primary font-black">{Math.floor(aggressorLevel)}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary shadow-glow-orange transition-all duration-500" style={{ width: `${aggressorLevel}%` }}></div>
                </div>
            </div>

            {/* Tactical Stake Controller - Expanded to fill void */}
            <div className="w-full flex-1 bg-black/60 border border-white/5 rounded-[32px] p-4 relative z-10 flex flex-col items-center justify-center gap-4 overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] opacity-5 pointer-events-none animate-spin-slow">
                <Radar size={200} />
              </div>

              {/* Stake Display */}
              <div 
                onClick={() => { setIsNumpadOpen(true); setManualInput(""); }}
                className="flex flex-col items-center relative z-10 cursor-pointer p-2 rounded-2xl hover:bg-white/5 transition-colors"
              >
                  <span className="text-[10px] font-mono text-[#555] uppercase font-black tracking-[0.4em] mb-1">Extraction_Stake</span>
                  <div className="flex items-baseline tabular-nums gap-1 pr-1">
                    <span className="text-5xl font-mono font-black text-white tracking-tighter leading-none italic drop-shadow-lg pr-[2px]">{formatSmart(currentWager)}</span>
                    <span className="text-sm text-primary font-black uppercase opacity-60 italic pr-[2px]">CH</span>
                  </div>
              </div>

              {/* Percentages */}
              <div className="grid grid-cols-4 gap-2 w-full max-w-[280px]">
                {[ -5, +5, +10, 'MAX' ].map((val, i) => (
                  <button key={i} onClick={() => {
                    if (val === 'MAX') {
                      if (wagerPct >= maxWagerPercent) { setMaxWagerHint(true); return; }
                      setManualInput(''); setWagerPct(maxWagerPercent);
                    } else {
                      const next = Math.max(1, Math.min(maxWagerPercent, wagerPct + (val as number)));
                      if (next === wagerPct && val !== -5) { setMaxWagerHint(true); return; }
                      setManualInput(''); setWagerPct(next);
                    }
                  }} className={`h-10 rounded-xl flex items-center justify-center font-mono font-black text-[10px] transition-all active:scale-90 border ${val === 'MAX' ? 'bg-primary text-black border-transparent shadow-glow-orange' : 'bg-[#0A0A0A] border-white/5 text-white/20 hover:text-white hover:border-white/20'}`}>
                    {val === 'MAX' ? 'MAX' : (typeof val === 'number' && val > 0) ? `+${val}%` : `${val}%`}
                  </button>
                ))}
              </div>

              {/* Max Wager Hint */}
              {maxWagerHint && (
                <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-xl animate-scale-up w-full max-w-[280px]">
                  <AlertTriangle size={12} className="text-primary shrink-0" />
                  <span className="text-[9px] font-mono font-black text-primary/80">
                    MAX STAKE — {Math.floor(maxWagerPercent)}% от банка на G_{getRoman(generation)}
                  </span>
                </div>
              )}

              {/* Search Error */}
              {searchError && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl animate-scale-up w-full max-w-[280px]">
                  <ShieldAlert size={12} className="text-red-500 shrink-0" />
                  <span className="text-[9px] font-mono font-black text-red-400">{searchError}</span>
                </div>
              )}

              {/* Stats Grid */}
              <div className="w-full grid grid-cols-2 gap-4 pt-3 border-t border-white/5 mt-1">
                 <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-[#555]">
                        <ShieldAlert size={10} />
                        <span className="text-[8px] font-mono uppercase font-black tracking-wider">Net_Tax</span>
                    </div>
                    <span className="text-xs font-mono font-black text-red-500/80">-{formatSmart(networkTax)}</span>
                 </div>
                 <div className="flex flex-col gap-1 items-end">
                    <div className="flex items-center gap-1.5 text-[#555]">
                        <Zap size={10} />
                        <span className="text-[8px] font-mono uppercase font-black tracking-wider">Potential_Yield</span>
                    </div>
                    <span className="text-xs font-mono font-black text-green-500 shadow-glow-green">+{formatSmart(potentialProfit)}</span>
                 </div>
              </div>
            </div>

            {/* Action Button Section (Bottom) */}
            <div className="w-full flex flex-col items-center gap-3 z-10 shrink-0 mt-auto">
                <button 
                    onClick={isRechargeNeeded ? () => setBattleState('payment') : startBattle} 
                    className={`w-full h-14 rounded-[24px] font-black text-lg uppercase italic tracking-tighter flex items-center justify-center gap-3 transition-all active:scale-[0.98] relative overflow-hidden group
                        ${isRechargeNeeded 
                            ? 'bg-orange-500 text-black shadow-glow-orange' 
                            : 'bg-primary text-black shadow-glow-orange'}`}
                >
                   <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                   {isRechargeNeeded ? <RefreshCw size={20} className="animate-spin-slow" /> : <Swords size={20} />}
                   <span className="relative z-10">{isRechargeNeeded ? 'RECHARGE LINK' : 'INJECT BREACH'}</span>
                </button>

                <div className="flex flex-col items-center gap-1.5">
                    <div className="flex gap-1.5">
                        {Array.from({ length: 5 }).map((_, i) => {
                            const hasAttempt = i < fightsLeft + extraFights;
                            return (
                                <div key={i} className={`h-1.5 w-8 rounded-full transition-all duration-500 ${hasAttempt ? 'bg-primary shadow-glow-orange' : 'bg-[#222]'}`} />
                            );
                        })}
                    </div>
                    <span className="text-[8px] font-mono text-white/30 uppercase font-black tracking-[0.2em]">
                        Daily_Allocations
                    </span>
                </div>
            </div>
          </div>
      </div>

      {/* Manual Input Numpad Modal */}
      {isNumpadOpen && (
        <div className="fixed inset-0 z-[3000] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setIsNumpadOpen(false)} />
            <div className="relative w-full max-w-sm bg-[#0A0A0A] rounded-t-[44px] border border-white/10 p-8 pb-32 animate-slide-up shadow-2xl flex flex-col">
                <div className="absolute inset-0 bg-noise opacity-5 pointer-events-none"></div>
                <div className="flex justify-between items-center mb-6 relative z-10">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-mono text-primary font-black uppercase tracking-widest mb-1">Manual_Stake</span>
                        <div className="flex items-baseline tabular-nums gap-1.5 min-h-[42px] pr-2">
                            <span className={`text-3xl font-mono font-black italic tracking-tighter ${isInputOverLimit ? 'text-red-500' : 'text-white'} pr-1`}>
                                {manualInput ? formatSmart(parseFloat(manualInput) || 0) : "0"}
                            </span>
                            <span className="text-sm text-primary font-black uppercase opacity-40 italic shrink-0 pr-1">CH</span>
                        </div>
                    </div>
                    <button onClick={() => isInputOverLimit ? setManualInput(Math.floor(maxPossibleWager).toString()) : setIsNumpadOpen(false)} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 border ${isInputOverLimit ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-primary/20 border-primary/40 text-primary'}`}>
                        {isInputOverLimit ? <X size={28} /> : <CheckCircle2 size={28} />}
                    </button>
                </div>
                <div className="grid grid-cols-4 gap-2.5 mb-4 relative z-10">
                    <div className="grid grid-cols-3 gap-2.5 col-span-3">
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'clear'].map((key) => (
                            <button key={key} onClick={() => handleNumpadKey(key)} className="h-12 rounded-xl text-lg font-mono font-black bg-white/5 border border-white/10 text-white active:scale-95 transition-all">
                                {key.toUpperCase()}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-col gap-2.5">
                        <button onClick={() => handleNumpadKey('del')} className="h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white/40 active:scale-90"><Delete size={20} /></button>
                        {['10%', '50%', '90%'].map(pct => (
                            <button key={pct} onClick={() => handleNumpadKey(pct)} className="h-12 bg-primary/10 border border-primary/20 rounded-xl text-primary text-[10px] font-black italic active:scale-90">{pct}</button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Battle Overlays */}
      {battleState !== 'idle' && (
        <div className="fixed inset-0 z-[2000] bg-[#050505] flex flex-col items-center p-6 pt-12 animate-scale-up overflow-hidden">
          <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none"></div>

          {battleState === 'searching' && (
            <div className="flex flex-col items-center justify-center h-full gap-8">
              <div className="relative">
                 <div className="absolute inset-0 border-2 border-primary/20 rounded-full animate-ping"></div>
                 <div className="w-24 h-24 bg-primary/10 rounded-full border border-primary/40 flex items-center justify-center text-primary relative"><Search size={40} className="animate-pulse" /></div>
              </div>
              <div className="flex flex-col items-center">
                  <span className="text-xl font-black text-white uppercase italic tracking-tighter animate-pulse">Scanning_Network...</span>
                  <div className="flex flex-col gap-1 mt-4 font-mono text-[8px] text-primary/40 text-center">
                    <span>CONNECTING_NODE_0x77...</span>
                    <span>BYPASSING_NAT_PROTOCOL...</span>
                    <span>SIGNAL_STRENGTH_88dBm...</span>
                  </div>
              </div>
            </div>
          )}
          
          {battleState === 'versus' && opponent && (
            <div className="w-full h-full flex flex-col justify-center items-center py-10 pt-10 pb-28 animate-scale-up relative gap-2">
                
                {/* User Card (Top) - Symmetrical & Buffed */}
                <div className="w-full bg-[#0D0D0D] border border-white/10 rounded-[32px] p-6 relative overflow-hidden shadow-2xl z-10 flex flex-col gap-4">
                    <div className="absolute -right-6 -top-6 text-white/[0.03] rotate-12 pointer-events-none">
                        <userLeague.icon size={160} fill="currentColor" />
                    </div>
                    
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-mono text-primary font-black uppercase tracking-widest mb-1">Source_Operator</span>
                            <h3 className="text-3xl text-white font-black uppercase italic tracking-tighter">YOU</h3>
                        </div>
                    </div>

                    {/* Buffs Row */}
                    <div className="flex items-center gap-2 relative z-10">
                        <div className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${userLeague.bg} ${userLeague.border}`}>
                            <userLeague.icon size={12} className={userLeague.color} />
                            <span className={`text-[8px] font-mono font-black uppercase tracking-wider ${userLeague.color}`}>{userLeague.name}</span>
                        </div>
                        <div className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${genInfo.bg} ${genInfo.border}`}>
                            <Dna size={12} className={genInfo.color} />
                            <span className={`text-[8px] font-mono font-black uppercase tracking-wider ${genInfo.color}`}>G_{getRoman(generation)}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 relative z-10 border-t border-white/5 pt-4 mt-1">
                         <div className="flex flex-col">
                            <span className="text-[7px] text-white/20 uppercase font-black mb-1 tracking-widest">Networth</span>
                            <span className="text-[13px] font-mono font-black text-white">{formatSmart(balance)}</span>
                         </div>
                         <div className="flex flex-col items-end">
                            <span className="text-[7px] text-white/20 uppercase font-black mb-1 tracking-widest">Win_Rate</span>
                            <span className="text-[13px] font-mono font-black text-primary leading-none">64.2%</span>
                         </div>
                    </div>
                </div>

                {/* VS Badge - Minimalist Design */}
                <div className="z-30 flex flex-col items-center justify-center relative my-2">
                    <div className="w-full max-w-[120px] h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent absolute"></div>
                    <div className="w-5 h-5 rounded-sm bg-[#0A0A0A] border border-primary/40 flex items-center justify-center rotate-45 z-10 shadow-[0_0_10px_rgba(255,59,0,0.15)]">
                         <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></div>
                    </div>
                    <span className="absolute -bottom-4 text-[7px] font-mono text-white/30 tracking-[0.2em] uppercase font-bold">VS</span>
                </div>

                {/* Opponent Card (Bottom) - Symmetrical & Buffed */}
                <div className="w-full bg-[#0D0D0D] border-2 border-primary/20 rounded-[32px] p-6 relative overflow-hidden shadow-[0_0_40px_rgba(255,59,0,0.1)] z-10 flex flex-col gap-4">
                    <div className="absolute -right-6 -bottom-6 text-primary/[0.04] -rotate-12 pointer-events-none">
                        <opponent.league.icon size={160} fill="currentColor" />
                    </div>

                     <div className="flex justify-between items-start relative z-10">
                        <div className="flex flex-col w-full">
                            <span className="text-[9px] font-mono text-primary font-black uppercase tracking-widest mb-1">Target_Node</span>
                            <h3 className="text-xl text-white font-black uppercase italic tracking-tighter truncate w-full">{opponent.username}</h3>
                        </div>
                    </div>

                    {/* Buffs Row Opponent */}
                    <div className="flex items-center gap-2 relative z-10">
                         {(() => {
                            const opGenInfo = getGenInfo(opponent.gen);
                            return (
                                <>
                                    <div className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${opponent.league.bg} ${opponent.league.border}`}>
                                        <opponent.league.icon size={12} className={opponent.league.color} />
                                        <span className={`text-[8px] font-mono font-black uppercase tracking-wider ${opponent.league.color}`}>{opponent.league.name}</span>
                                    </div>
                                    <div className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${opGenInfo.bg} ${opGenInfo.border}`}>
                                        <Dna size={12} className={opGenInfo.color} />
                                        <span className={`text-[8px] font-mono font-black uppercase tracking-wider ${opGenInfo.color}`}>G_{getRoman(opponent.gen)}</span>
                                    </div>
                                </>
                            );
                         })()}
                    </div>

                    <div className="grid grid-cols-2 gap-2 relative z-10 border-t border-white/5 pt-4 mt-1">
                         <div className="flex flex-col">
                            <span className="text-[7px] text-white/20 uppercase font-black mb-1 tracking-widest">Networth</span>
                            <span className="text-[13px] font-mono font-black text-white">{formatSmart(opponent.networth)}</span>
                         </div>
                         <div className="flex flex-col items-end">
                            <span className="text-[7px] text-white/20 uppercase font-black mb-1 tracking-widest">Win_Rate</span>
                            <span className="text-[13px] font-mono font-black text-primary leading-none">{opponent.winRate}%</span>
                         </div>
                    </div>
                </div>
            </div>
          )}

          {battleState === 'battle' && (
            <div className="w-full max-w-sm flex flex-col items-center justify-center h-full gap-10 relative">
               <div className="w-64 h-64 relative flex items-center justify-center">
                  <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
                  {/* Fixed SVG: explicit width/height in px + viewBox to prevent collapse */}
                  <svg className="absolute inset-0 w-full h-full rotate-[-90deg]" viewBox="0 0 100 100" width="256" height="256">
                      <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.02)" strokeWidth="6" fill="transparent" />
                      <circle cx="50" cy="50" r="45" stroke={result === 'loss' ? '#ef4444' : '#FF3B00'} strokeWidth="6" fill="transparent"
                          strokeDasharray="283" 
                          strokeDashoffset={isNaN(battleProgress) ? 283 : Math.max(0, 283 - ((battleProgress || 0) / 100) * 283)} 
                          strokeLinecap="round"
                          className="transition-all duration-300 shadow-glow-orange"
                      />
                  </svg>
                  <div className="flex flex-col items-center z-10">
                      <span className={`text-7xl font-mono font-black italic tracking-tighter tabular-nums drop-shadow-glow ${result === 'loss' ? 'text-red-500' : 'text-white'}`}>
                        {Math.floor(battleProgress || 0)}%
                      </span>
                      <span className={`text-[10px] font-mono uppercase font-black tracking-[0.6em] mt-2 ${result === 'loss' ? 'text-red-500 animate-pulse' : 'text-primary animate-pulse'}`}>
                        {result === 'loss' ? 'CONNECTION_LOST' : 'Injecting...'}
                      </span>
                  </div>
               </div>

               {/* Professional Hacker Terminal */}
               <div className={`w-full bg-[#0D0D0D] border-2 rounded-[32px] p-6 font-mono flex flex-col gap-3 relative overflow-hidden shadow-2xl transition-colors ${result === 'loss' ? 'border-red-500/50' : 'border-white/5'}`}>
                    <div className="absolute inset-0 bg-noise opacity-5 pointer-events-none"></div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                         <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full animate-pulse ${result === 'loss' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                             <span className="text-[9px] font-black text-white uppercase tracking-widest italic">Live_Injection_Terminal</span>
                         </div>
                         <BarChart3 size={12} className="text-primary/40" />
                    </div>
                    <div className="flex flex-col gap-2 min-h-[80px]">
                        {battleLogs.map((log, i) => (
                            <div key={i} className={`flex items-start gap-2 text-[10px] ${(log || '').includes('CRITICAL') || (log || '').includes('WARNING') ? 'text-red-500 font-bold' : i === 0 ? 'text-primary font-black' : 'text-white/20'}`}>
                                <span>{'>'}</span>
                                <span className={i === 0 ? 'animate-pulse' : ''}>{log || ''}</span>
                            </div>
                        ))}
                    </div>
               </div>
            </div>
          )}

          {/* Unified Result Ticket */}
          {battleState === 'result' && result && (
            <div className="w-full h-full flex flex-col items-center justify-center py-6 max-w-sm relative z-50">
              
              <div className="w-full bg-[#0D0D0D] border border-white/10 rounded-[36px] overflow-hidden relative shadow-2xl flex flex-col animate-scale-up">
                 
                 {/* Top Strip: Status */}
                 <div className={`w-full py-6 flex items-center justify-center relative ${result === 'win' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    <div className="absolute inset-0 bg-noise opacity-10 pointer-events-none"></div>
                    <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border ${result === 'win' ? 'border-green-500/30 text-green-500' : 'border-red-500/30 text-red-500'}`}>
                        {result === 'win' ? <ShieldCheck size={14} /> : <ShieldX size={14} />}
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            {result === 'win' ? 'BREACH_SUCCESS' : 'BREACH_FAILED'}
                        </span>
                    </div>
                 </div>

                 {/* Middle: Amount */}
                 <div className="flex flex-col items-center py-8 border-b border-dashed border-white/10 relative">
                     <span className={`text-6xl font-black italic tracking-tighter tabular-nums drop-shadow-lg ${result === 'win' ? 'text-white' : 'text-red-500'}`}>
                         {result === 'win' ? '+' : '-'}{formatSmart(result === 'win' ? frozenYield : frozenWager)}
                     </span>
                     <span className="text-[10px] font-mono font-black text-[#555] uppercase tracking-[0.2em] mt-2">
                        CH_Volume
                     </span>

                     {/* Decorative jagged circles */}
                     <div className="absolute -left-3 bottom-[-10px] w-6 h-6 rounded-full bg-[#050505] z-10"></div>
                     <div className="absolute -right-3 bottom-[-10px] w-6 h-6 rounded-full bg-[#050505] z-10"></div>
                 </div>

                 {/* Bottom: Details */}
                 <div className="p-6 flex flex-col gap-4 bg-[#111]">
                    
                    {/* Detailed Full Number Breakdown */}
                    <div className="flex flex-col gap-2 border-b border-white/5 pb-4 mb-2">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                            <span className="text-[#555] uppercase font-bold tracking-tight">Entry Stake</span>
                            <span className="text-white tabular-nums font-bold">{frozenWager.toLocaleString('en-US')} CH</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-mono">
                             <span className="text-[#555] uppercase font-bold tracking-tight">Network Fee</span>
                             <span className="text-red-500/80 tabular-nums font-bold">-{frozenTax.toLocaleString('en-US')} CH</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-mono font-black mt-1">
                             <span className="text-[#555] uppercase tracking-tight">Total {result === 'win' ? 'Yield' : 'Loss'}</span>
                             <span className={`${result === 'win' ? 'text-green-500' : 'text-red-500'} tabular-nums`}>
                                {result === 'win' ? '+' : '-'}{result === 'win' ? frozenYield.toLocaleString('en-US') : frozenWager.toLocaleString('en-US')} CH
                             </span>
                        </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tight">
                        <span className="text-[#555]">Session Hash</span>
                        <span className="text-white/40 font-mono">{txHash.slice(0, 8)}...</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tight">
                        <span className="text-[#555]">Time</span>
                        <span className="text-white/40">{new Date().toLocaleTimeString()}</span>
                    </div>
                 </div>

                 {/* Footer Actions - Integrated */}
                 <div className="p-4 bg-[#080808] border-t border-white/10 flex gap-2">
                     {isRecoveryMode ? (
                        <div className="flex gap-2 w-full animate-scale-up">
                            <button 
                                onClick={performRecoveryTon} disabled={isRecovering || isTonProcessing}
                                className="flex-1 h-12 bg-white text-black rounded-xl font-black uppercase text-[10px] flex flex-col items-center justify-center active:scale-95"
                            >
                                <span>{isWalletConnected ? 'Pay TON' : 'Connect'}</span>
                                <span className="text-[8px] opacity-60">{tonPrices['pvp_recovery'] || '—'} TON</span>
                            </button>
                            <button 
                                onClick={performRecoveryStars} disabled={isRecovering}
                                className="flex-1 h-12 bg-[#222] text-primary border border-primary/30 rounded-xl font-black uppercase text-[10px] flex flex-col items-center justify-center active:scale-95"
                            >
                                <span>Pay Stars</span>
                                <span className="text-[8px] opacity-60">{starsPrices['pvp_recovery'] || '—'} Stars</span>
                            </button>
                            <button 
                                onClick={() => setIsRecoveryMode(false)}
                                className="w-12 h-12 bg-[#111] text-[#555] rounded-xl flex items-center justify-center active:scale-90"
                            >
                                <X size={16} />
                            </button>
                        </div>
                     ) : (
                        <div className="flex gap-2 w-full">
                            <button 
                                onClick={() => setBattleState('idle')} 
                                className="flex-1 h-14 bg-white text-black font-black uppercase rounded-[18px] flex items-center justify-center gap-2 text-sm italic tracking-tighter active:scale-95 transition-all shadow-glow-white hover:bg-gray-100"
                            >
                                Terminate
                            </button>
                            {result === 'loss' && (
                                <button 
                                    onClick={() => setIsRecoveryMode(true)}
                                    className="w-14 h-14 bg-[#161616] border border-white/10 rounded-[18px] flex items-center justify-center text-primary active:scale-90 transition-all hover:bg-white/5"
                                >
                                    <Shield size={20} />
                                </button>
                            )}
                        </div>
                     )}
                 </div>

              </div>
            </div>
          )}

          {battleState === 'payment' && (
            <div className="w-full max-w-sm flex flex-col items-center gap-6 mt-10 animate-scale-up h-full justify-center pb-20">
                <div className="flex flex-col items-center mb-4">
                    <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-4 animate-pulse">
                        <RefreshCw size={40} className="text-primary animate-spin-slow" />
                    </div>
                    <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">System Recharge</h2>
                    <p className="text-[10px] font-mono text-[#666] uppercase mt-2">Restore Authorization Keys</p>
                </div>

                <div className="w-full bg-[#0D0D0D] border border-white/10 rounded-[32px] p-6 flex flex-col gap-3">
                    <button 
                        onClick={handleRechargeTon}
                        disabled={isProcessingPayment || isTonProcessing}
                        className="w-full h-16 bg-white rounded-[20px] flex items-center justify-between px-6 active:scale-95 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <Wallet size={18} className="text-black" />
                            <span className="text-black font-black uppercase text-sm italic tracking-tighter">
                                {isWalletConnected ? 'TON_NETWORK' : 'CONNECT_WALLET'}
                            </span>
                        </div>
                        {(isProcessingPayment || isTonProcessing) ? <RefreshCw className="animate-spin text-black" size={16} /> : <span className="bg-black text-white px-3 py-1.5 rounded-xl text-[10px] font-mono font-black">{tonPrices['fight_refill'] || '—'} TON</span>}
                    </button>
                    
                    <button 
                        onClick={handleRechargeStars}
                        disabled={isProcessingPayment || isTonProcessing}
                        className="w-full h-16 bg-[#161616] border border-white/5 rounded-[20px] flex items-center justify-between px-6 active:scale-95 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <Star size={18} className="text-primary" fill="currentColor" />
                            <span className="text-white font-black uppercase text-sm italic tracking-tighter">STARS_GATEWAY</span>
                        </div>
                        {isProcessingPayment ? <RefreshCw className="animate-spin text-white" size={16} /> : <span className="text-primary border border-primary/20 px-3 py-1.5 rounded-xl text-[10px] font-mono font-black">{starsPrices['fight_refill'] || '—'} STARS</span>}
                    </button>
                </div>
                
                <button onClick={() => setBattleState('idle')} className="text-[10px] font-mono text-white/20 uppercase font-black hover:text-white transition-colors">
                    Cancel Operation
                </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
