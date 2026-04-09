
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Zap, Battery, RefreshCw, Terminal, Cpu, Network, Trophy, Activity, Box, Rocket, Layers, Crown, Award, Shield, Target } from 'lucide-react';
import { NetworkTier, MinedBlock, UpgradeItem } from '../../types';
import { getLeague } from '../../utils/getLeague';
import { fetchBlockFeed, ApiBlock } from '../../api';

interface MineTabProps {
  isMining: boolean;
  toggleMining: () => void;
  energy: number;
  maxEnergy: number;
  balance: number;
  miningCooldown?: number;
  onOpenPayment: (type: 'multitap' | 'energy' | 'autobot') => void;
  onOpenBlockDetail: (block: MinedBlock) => void;
  onOpenNetwork: () => void;
  currentNetwork: NetworkTier;
  generation: number;
  upgrades: UpgradeItem[];
  rank: number;
  onlineCount?: number;
  autoMining?: boolean;
  autoMiningRemaining?: number;
  turboActive?: boolean;
  turboRemaining?: number;
}

interface DynamicBlock {
  id: number;
  hash: string;
  reward: number;
  createdAt: number; // timestamp ms
  finder: string;
  participants: number;
  difficulty: string;
}

const formatTimeAgo = (ms: number): string => {
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
};

let blockIdCounter = 9000 + Math.floor(Math.random() * 1000);

const getGenRoman = (gen: number) => ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"][gen - 1] || "I";

// Ring circumference for viewBox 200x200, r=84
const RING_CIRCUMFERENCE = 2 * Math.PI * 84;

export const MineTab: React.FC<MineTabProps> = ({ 
    isMining, toggleMining, energy, maxEnergy, balance, miningCooldown = 0,
    onOpenPayment, onOpenBlockDetail, onOpenNetwork, currentNetwork,
    generation, upgrades, rank, onlineCount = 0,
    autoMining = false, autoMiningRemaining = 0, turboActive = false, turboRemaining = 0
}) => {
  const [isBalanceExpanded, setIsBalanceExpanded] = useState(false);

  // ─── Server-driven blocks feed ───
  const [blocks, setBlocks] = useState<DynamicBlock[]>([]);
  const [newBlockIds, setNewBlockIds] = useState<Set<number>>(new Set());
  const knownBlockIdsRef = useRef<Set<number>>(new Set());
  const isFirstLoadRef = useRef(true);

  const loadBlocks = useCallback(async () => {
    try {
      const res = await fetchBlockFeed(6);
      if (res.blocks && res.blocks.length > 0) {
        const incoming = res.blocks.map((b: ApiBlock) => ({
          id: b.id,
          hash: b.hash,
          reward: b.reward,
          createdAt: new Date(b.created_at).getTime(),
          finder: b.finder,
          participants: b.participants,
          difficulty: b.difficulty,
        }));

        // Detect newly appeared blocks (skip first load)
        if (!isFirstLoadRef.current) {
          const freshIds = new Set<number>();
          incoming.forEach((b: DynamicBlock) => {
            if (!knownBlockIdsRef.current.has(b.id)) freshIds.add(b.id);
          });
          if (freshIds.size > 0) {
            setNewBlockIds(freshIds);
            // Clear NEW tags after 10s
            setTimeout(() => setNewBlockIds(new Set()), 10_000);
          }
        }
        isFirstLoadRef.current = false;

        // Update known IDs
        knownBlockIdsRef.current = new Set(incoming.map((b: DynamicBlock) => b.id));
        setBlocks(incoming.slice(0, 6));
      }
    } catch { /* silent */ }
  }, []);

  // Fetch blocks on mount + poll every 8s
  useEffect(() => {
    loadBlocks();
    const timer = setInterval(loadBlocks, 8_000);
    return () => clearInterval(timer);
  }, [loadBlocks]);

  // Force re-render every second to update "time ago" labels
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const league = useMemo(() => {
    const info = getLeague(rank);
    return { name: info.name, color: info.color, mult: info.multiplier, icon: info.icon };
  }, [rank]);

  const tierInfo = useMemo(() => {
    const roman = getGenRoman(generation);
    let color = "text-primary";
    let glow = "shadow-glow-orange";
    if (generation >= 11) { color = "text-purple-500"; glow = "shadow-[0_0_15px_rgba(168,85,247,0.5)]"; }
    else if (generation >= 6) { color = "text-cyan-400"; glow = "shadow-[0_0_15px_rgba(34,211,238,0.5)]"; }
    return { roman, color, glow };
  }, [generation]);

  const coreUpgrade = upgrades.find(u => u.id === 'u2');
  const basePower = 0.005 + (coreUpgrade?.currentLevel || 0) * 0.005;
  const genMultiplier = Math.pow(1.5, generation - 1);
  const netMult = currentNetwork === 'Singularity' ? 4 : currentNetwork === 'Quantum Mesh' ? 2 : currentNetwork === 'Satellite Grid' ? 1.5 : 1;
  const totalMultiplier = genMultiplier * netMult * league.mult;
  const miningPerSecondBase = basePower * totalMultiplier;
  const miningPerSecond = turboActive ? miningPerSecondBase * 2 : miningPerSecondBase;
  const ENERGY_COST_RATIO = 50;
  const energyPerSecond = autoMining ? 0 : basePower * ENERGY_COST_RATIO;

  // ─── Smooth client-side interpolation between server polls ───
  const [displayBalance, setDisplayBalance] = useState(Number(balance) || 0);
  const [displayEnergy, setDisplayEnergy] = useState(Number(energy) || 0);

  // Snap to server values on each poll update
  useEffect(() => { setDisplayBalance(Number(balance) || 0); }, [balance]);
  useEffect(() => { setDisplayEnergy(Number(energy) || 0); }, [energy]);

  // Smooth tick between polls (visual only — server is authoritative)
  useEffect(() => {
    if (!isMining) return;
    const TICK = 200; // ms
    const id = setInterval(() => {
      setDisplayBalance(prev => prev + miningPerSecond * (TICK / 1000));
      if (!autoMining) {
        setDisplayEnergy(prev => Math.max(0, prev - energyPerSecond * (TICK / 1000)));
      }
    }, TICK);
    return () => clearInterval(id);
  }, [isMining, miningPerSecond, energyPerSecond]);

  const energyRatio = maxEnergy > 0 ? Math.max(0, Math.min(1, displayEnergy / maxEnergy)) : 0;

  // ─── Smart balance formatting ───
  // Adaptive decimals based on mining power (NOT mining state) — never jumps on start/stop.
  // Shows enough digits so each 200ms tick is visible as a live counter.
  const stableDecimals = useMemo(() => {
    // Determine suffix divisor based on current balance magnitude
    let divisor = 1;
    const b = displayBalance;
    if (b >= 1_000_000_000_000) divisor = 1_000_000_000_000;
    else if (b >= 1_000_000_000) divisor = 1_000_000_000;
    else if (b >= 1_000_000) divisor = 1_000_000;
    else if (b >= 1_000) divisor = 1_000;

    const tickPerFrame = miningPerSecond * 0.2; // amount per 200ms visual tick
    const tickInUnits = tickPerFrame / divisor;
    if (tickInUnits <= 0) return 3; // fallback
    // Enough decimals so tick changes the last visible digit
    return Math.min(8, Math.max(3, Math.ceil(-Math.log10(tickInUnits)) + 1));
  }, [miningPerSecond, displayBalance >= 1000, displayBalance >= 1_000_000, displayBalance >= 1_000_000_000, displayBalance >= 1_000_000_000_000]);

  const [intPart, fracPart] = useMemo(() => {
    const b = displayBalance;

    let suffix = '';
    let divisor = 1;
    if (b >= 1_000_000_000_000) { suffix = 'T'; divisor = 1_000_000_000_000; }
    else if (b >= 1_000_000_000) { suffix = 'B'; divisor = 1_000_000_000; }
    else if (b >= 1_000_000) { suffix = 'M'; divisor = 1_000_000; }
    else if (b >= 1_000) { suffix = 'K'; divisor = 1_000; }

    const displayed = b / divisor;
    const parts = displayed.toFixed(stableDecimals).split('.');
    return [parts[0] + suffix, parts[1]];
  }, [displayBalance, stableDecimals]);

  return (
    <div className="flex flex-col w-full pt-0 gap-2 pb-4 select-none">
      {/* Dynamic Balance Widget (Enhanced Orange Core) */}
      <div className={`w-full bg-primary rounded-[32px] px-6 py-6 relative overflow-hidden group transition-all duration-500 ${
        turboActive
          ? 'shadow-[0_0_40px_rgba(255,0,0,0.5),0_0_80px_rgba(255,0,0,0.25),0_0_120px_rgba(255,0,0,0.1)]'
          : 'shadow-glow-orange'
      }`}>
         <div className="absolute inset-0 bg-noise opacity-15 pointer-events-none"></div>
         {turboActive && (<>
           <div className="absolute inset-0 pointer-events-none rounded-[32px] z-[1]" style={{
             background: 'linear-gradient(135deg, rgba(255,0,0,0.15) 0%, transparent 50%, rgba(255,0,0,0.1) 100%)',
             animation: 'turbo-banner-shimmer 2s ease-in-out infinite',
           }} />
           <div className="absolute -top-1 -left-1 -right-1 -bottom-1 pointer-events-none rounded-[34px] z-0" style={{
             background: 'linear-gradient(90deg, transparent 0%, rgba(255,0,0,0.25) 50%, transparent 100%)',
             backgroundSize: '200% 100%',
             animation: 'turbo-banner-sweep 2s ease-in-out infinite',
           }} />
           <style>{`
             @keyframes turbo-banner-shimmer {
               0%, 100% { opacity: 0.4; }
               50% { opacity: 1; }
             }
             @keyframes turbo-banner-sweep {
               0% { background-position: -200% 0; }
               100% { background-position: 200% 0; }
             }
           `}</style>
         </>)}
         
         {/* Background League Icon Branding */}
         <div className="absolute -right-8 -top-8 text-black/10 transition-transform duration-700 group-hover:scale-110 group-hover:rotate-12 pointer-events-none">
            <league.icon size={180} fill="currentColor" />
         </div>

         <div className="relative z-10 flex flex-col">
            <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2 bg-black/90 px-3 py-1 rounded-xl border border-black/10 backdrop-blur-md">
                    <league.icon size={12} className={`${league.color}`} fill="currentColor" />
                    <span className={`text-[10px] font-black uppercase ${league.color}`}>{league.name}</span>
                    <div className="w-[1px] h-3 bg-white/10 mx-1"></div>
                    <span className="text-[10px] font-black text-white italic tracking-tighter">x{totalMultiplier.toFixed(1)}</span>
                </div>
                <button onClick={() => setIsBalanceExpanded(!isBalanceExpanded)} className="p-2 bg-black/10 rounded-xl text-black/50 hover:bg-black/20 transition-all">
                    <Terminal size={14} />
                </button>
            </div>
            
            <div className="flex items-baseline tabular-nums overflow-hidden mt-1">
                <span className="text-[52px] font-mono font-black text-black tracking-tighter leading-none">
                    {intPart}
                </span>
                <span className="text-2xl text-black/25 font-black ml-1">.{fracPart}</span>
            </div>

            {/* Spoiler Details */}
            <div className={`overflow-hidden transition-all duration-500 ${isBalanceExpanded ? 'max-h-[300px] opacity-100 mt-5' : 'max-h-0 opacity-0'}`}>
                <div className="pt-4 border-t border-black/10 flex flex-col gap-2 bg-black/5 p-3 rounded-2xl">
                    <div className="flex justify-between text-[9px] font-mono font-black text-black/60 uppercase">
                        <span>Base_Hash_Power</span>
                        <span>{basePower.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-[9px] font-mono font-black text-black/60 uppercase">
                        <span>Neural_Generation</span>
                        <span>x{genMultiplier}</span>
                    </div>
                    <div className="flex justify-between text-[9px] font-mono font-black text-black/60 uppercase">
                        <span>Network_Efficiency</span>
                        <span>x{netMult}</span>
                    </div>
                </div>
            </div>

            {/* Full-Width Equalizer Visualizer */}
            <div className="flex items-end gap-[3px] h-6 w-full mt-4 opacity-30">
                 {Array.from({ length: 42 }).map((_, i) => (
                   <div 
                    key={i} 
                    className={`flex-1 bg-black rounded-t-[1px] transition-all duration-300 ${isMining ? 'animate-bounce' : 'h-[2px]'}`} 
                    style={{ 
                        height: isMining ? `${20 + Math.random() * 80}%` : '2px', 
                        animationDelay: `${i * 0.05}s`,
                        animationDuration: `${0.4 + Math.random() * 0.6}s`
                    }}
                   />
                 ))}
            </div>
         </div>
      </div>

      {/* Main Mine Sphere */}
      <div className="relative flex flex-col gap-2">
         <div className={`aspect-square bg-[#0D0D0D] rounded-[44px] border relative flex items-center justify-center p-4 shadow-2xl overflow-hidden transition-all duration-1000 ${
              turboActive
                ? isMining
                  ? 'border-[#FF3B00]/20 shadow-[0_0_40px_rgba(255,59,0,0.1),inset_0_0_60px_rgba(255,59,0,0.04)]'
                  : 'border-[#FF3B00]/10 shadow-[0_0_25px_rgba(255,59,0,0.06)]'
                : 'border-[#1A1A1A]'
            }`}>
              {turboActive && (
                <div className="absolute inset-0 pointer-events-none z-[1] rounded-[44px] transition-all duration-1000"
                     style={{ boxShadow: isMining
                       ? 'inset 0 0 50px rgba(255,59,0,0.06), inset 0 0 100px rgba(255,59,0,0.03)'
                       : 'inset 0 0 30px rgba(255,59,0,0.03), inset 0 0 60px rgba(255,59,0,0.015)'
                     }} />
              )}
             <div className="absolute top-7 left-7 right-7 flex items-center justify-between z-20">
                <div className={`flex items-center gap-1.5 px-3 py-1 bg-black/40 rounded-full border border-primary/20 backdrop-blur-sm ${tierInfo.glow}`}>
                    <Cpu size={10} className={tierInfo.color} />
                    <span className={`text-[9px] font-mono font-black uppercase tracking-widest ${tierInfo.color}`}>G_{tierInfo.roman}</span>
                </div>
                <button onClick={onOpenNetwork} className="flex items-center gap-1.5 px-3 py-1 bg-black/60 rounded-full border border-[#222] active:scale-95 transition-all">
                    <Network size={10} className="text-primary" />
                    <span className="text-[9px] font-mono font-black text-white uppercase">{currentNetwork.split(' ')[0]}</span>
                </button>
             </div>

             <div className="relative w-full h-full flex items-center justify-center scale-[0.85]">
                 {/* ═══ TURBO BOOST EFFECTS (only when mining) ═══ */}
                 {turboActive && isMining && (<>
                   {/* Layer 1: INTENSE RED breathing glow behind sphere */}
                   <div className="absolute inset-[-40px] rounded-full pointer-events-none"
                        style={{
                          background: 'radial-gradient(circle, rgba(255,0,0,0.35) 0%, rgba(255,0,0,0.15) 40%, rgba(255,50,0,0.05) 60%, transparent 75%)',
                          animation: 'turbo-breathe 1.8s ease-in-out infinite, turbo-fadein 0.5s ease-out both',
                        }} />
                   {/* Layer 2: INTENSE RED pulsing rings */}
                   <div className="absolute inset-[-10px] rounded-full border-[3px] border-[#FF0000]/40 pointer-events-none"
                        style={{ animation: 'turbo-ring 2s ease-out infinite, turbo-fadein 0.8s ease-out 0.2s both' }} />
                   <div className="absolute inset-[-5px] rounded-full border-2 border-[#FF1A1A]/30 pointer-events-none"
                        style={{ animation: 'turbo-ring 2s ease-out infinite 0.6s, turbo-fadein 0.8s ease-out 0.4s both' }} />
                   <div className="absolute inset-0 rounded-full border border-[#FF3333]/20 pointer-events-none"
                        style={{ animation: 'turbo-ring 2s ease-out infinite 1.2s, turbo-fadein 0.8s ease-out 0.6s both' }} />
                   {/* Layer 3: Orange electric sparks — slow orbit */}
                   <div className="absolute inset-[-5px] pointer-events-none" style={{ animation: 'spin 8s linear infinite, turbo-fadein 1.2s ease-out 0.5s both' }}>
                     <div className="absolute top-[10%] left-[50%] w-1 h-1 bg-[#FF3B00] rounded-full shadow-[0_0_6px_#FF3B00,0_0_12px_#FF3B00]" style={{ animation: 'turbo-spark 1.2s ease-in-out infinite' }} />
                     <div className="absolute top-[50%] right-[5%] w-0.5 h-0.5 bg-[#FF6B35] rounded-full shadow-[0_0_4px_#FF3B00,0_0_8px_#FF3B00]" style={{ animation: 'turbo-spark 1.5s ease-in-out infinite 0.4s' }} />
                     <div className="absolute bottom-[12%] left-[30%] w-1 h-1 bg-[#FF3B00] rounded-full shadow-[0_0_6px_#FF3B00,0_0_12px_#FF3B00]" style={{ animation: 'turbo-spark 1.0s ease-in-out infinite 0.8s' }} />
                   </div>
                   <div className="absolute inset-[-5px] pointer-events-none" style={{ animation: 'spin 10s linear infinite reverse, turbo-fadein 1.2s ease-out 0.8s both' }}>
                     <div className="absolute top-[25%] right-[10%] w-0.5 h-0.5 bg-white rounded-full shadow-[0_0_4px_#FF3B00]" style={{ animation: 'turbo-spark 1.4s ease-in-out infinite 0.2s' }} />
                     <div className="absolute bottom-[30%] right-[20%] w-1 h-1 bg-[#FF3B00] rounded-full shadow-[0_0_6px_#FF3B00,0_0_10px_#FF3B00]" style={{ animation: 'turbo-spark 1.6s ease-in-out infinite 0.6s' }} />
                     <div className="absolute top-[60%] left-[8%] w-0.5 h-0.5 bg-white rounded-full shadow-[0_0_4px_#FF3B00]" style={{ animation: 'turbo-spark 1.3s ease-in-out infinite 1.0s' }} />
                   </div>
                   {/* Layer 4: INTENSE RED center pulse wave */}
                   <div className="absolute w-40 h-40 rounded-full pointer-events-none z-[5]"
                        style={{
                          background: 'radial-gradient(circle, rgba(255,0,0,0.25) 0%, rgba(255,30,0,0.1) 50%, rgba(255,50,0,0.02) 70%, transparent 80%)',
                          animation: 'turbo-wave 1.5s ease-out infinite, turbo-fadein 0.6s ease-out 0.3s both',
                        }} />
                   {/* Layer 5: FAST HEARTBEAT overlay */}
                   <div className="absolute w-36 h-36 rounded-full pointer-events-none z-[6] border-4 border-[#FF0000]/50"
                        style={{ animation: 'turbo-heartbeat 0.8s ease-in-out infinite' }} />
                 </>)}
                 {/* ═══ TURBO KEYFRAMES — ENHANCED INTENSITY ═══ */}
                 <style>{`
                   @keyframes turbo-fadein {
                     from { opacity: 0; }
                     to { opacity: 1; }
                   }
                   @keyframes turbo-breathe {
                     0%, 100% { opacity: 0.6; transform: scale(1); }
                     50% { opacity: 1; transform: scale(1.12); }
                   }
                   @keyframes turbo-ring {
                     0% { transform: scale(0.8); opacity: 0.8; }
                     100% { transform: scale(2); opacity: 0; }
                   }
                   @keyframes turbo-spark {
                     0%, 100% { opacity: 1; transform: scale(1); }
                     50% { opacity: 0.1; transform: scale(0.15); }
                   }
                   @keyframes turbo-wave {
                     0% { transform: scale(0.3); opacity: 0.9; }
                     100% { transform: scale(1.8); opacity: 0; }
                   }
                   @keyframes turbo-heartbeat {
                     0%, 100% { transform: scale(1); opacity: 0.5; border-width: 4px; }
                     50% { transform: scale(1.05); opacity: 0.8; border-width: 6px; }
                     25%, 75% { transform: scale(1.02); opacity: 0.6; }
                   }
                 `}</style>

                 {/* ═══ AUTO-MINING RING ═══ */}
                 <div className={`absolute inset-0 w-full h-full ${autoMining ? '' : 'hidden'}`}
                      style={autoMining ? { animation: 'spin 6s linear infinite' } : undefined}>
                    <svg viewBox="0 0 200 200" className="w-full h-full rotate-[-90deg]">
                       <circle cx="100" cy="100" r="84" stroke="#111" strokeWidth="8" fill="transparent" />
                       <circle cx="100" cy="100" r="84"
                           stroke={turboActive ? "#FF0000" : "#22c55e"}
                           strokeWidth={turboActive ? "10" : "8"} fill="transparent"
                           strokeDasharray={`${RING_CIRCUMFERENCE * 0.2} ${RING_CIRCUMFERENCE * 0.3}`}
                           strokeLinecap="round" opacity="0.8"
                           style={turboActive ? { filter: 'drop-shadow(0 0 12px rgba(255,0,0,0.8)) drop-shadow(0 0 20px rgba(255,0,0,0.4))' } : undefined}
                       />
                    </svg>
                 </div>
                 {/* ═══ NORMAL / TURBO ENERGY RING ═══ */}
                 {!autoMining && (
                   <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full rotate-[-90deg]">
                      <circle cx="100" cy="100" r="84" stroke="#111" strokeWidth="8" fill="transparent" />
                      <circle cx="100" cy="100" r="84"
                        stroke={turboActive ? "#FF0000" : "#FF3B00"}
                        strokeWidth={turboActive ? "12" : "8"} fill="transparent"
                        strokeDasharray={RING_CIRCUMFERENCE}
                        strokeDashoffset={RING_CIRCUMFERENCE * (1 - energyRatio)}
                        strokeLinecap="round" className="transition-none"
                        style={turboActive ? { filter: 'drop-shadow(0 0 15px rgba(255,0,0,0.9)) drop-shadow(0 0 30px rgba(255,0,0,0.5)) drop-shadow(0 0 50px rgba(255,0,0,0.3))' } : undefined}
                      />
                   </svg>
                 )}

                 {/* ═══ MINING BUTTON ═══ */}
                 <button 
                    onClick={() => {
                        if (autoMining) return;
                        if (miningCooldown > 0) return;
                        if (!isMining && energy <= 0) return;
                        toggleMining();
                    }} 
                    className={`w-40 h-40 rounded-full flex flex-col items-center justify-center transition-all duration-500 z-10 border-2 ${
                        autoMining
                            ? turboActive
                                ? 'bg-black border-[#FF0000]/60 shadow-[inset_0_0_60px_rgba(255,0,0,0.2),0_0_30px_rgba(255,0,0,0.3)]'
                                : 'bg-black border-green-500/50 shadow-[inset_0_0_50px_rgba(34,197,94,0.1)]'
                            : miningCooldown > 0
                                ? 'bg-[#121212] border-yellow-500/30 shadow-[inset_0_0_30px_rgba(234,179,8,0.05)]'
                                : isMining 
                                    ? turboActive
                                        ? 'bg-black border-[#FF0000] shadow-[inset_0_0_70px_rgba(255,0,0,0.2),0_0_40px_rgba(255,0,0,0.4),0_0_80px_rgba(255,0,0,0.2)]'
                                        : 'bg-black border-primary shadow-[inset_0_0_50px_rgba(255,59,0,0.1)]' 
                                    : energy <= 0 
                                        ? 'bg-[#121212] border-[#333] opacity-40 cursor-not-allowed' 
                                        : 'bg-[#121212] border-[#222]'
                    }`}
                 >
                    {autoMining ? (
                        <div className="flex flex-col items-center">
                            <RefreshCw size={22} className={`${turboActive ? 'text-[#FF0000]' : 'text-green-400'} animate-spin mb-2`} />
                            <span className={`text-[10px] font-mono font-black uppercase tracking-widest ${turboActive ? 'text-[#FF0000]/80' : 'text-green-400/60'}`}>Auto_Mine</span>
                            <span className={`text-2xl font-mono font-black tabular-nums leading-none mt-1 ${turboActive ? 'text-[#FF0000]' : 'text-green-400'}`}>
                                {Math.floor(autoMiningRemaining / 3600)}h {Math.floor((autoMiningRemaining % 3600) / 60)}m
                            </span>
                            {turboActive && <span className="text-[8px] font-mono font-black text-[#FF0000] uppercase mt-1 animate-pulse drop-shadow-[0_0_8px_rgba(255,0,0,0.8)]">⚡ TURBO x2</span>}
                        </div>
                    ) : miningCooldown > 0 ? (
                        <div className="flex flex-col items-center">
                            <RefreshCw size={16} className="text-yellow-500/60 animate-spin mb-1" />
                            <span className="text-3xl font-mono font-black text-yellow-500/80 tabular-nums leading-none">{miningCooldown}</span>
                            <span className="text-[10px] font-mono text-yellow-500/30 uppercase font-black mt-0.5">Cooldown</span>
                        </div>
                    ) : isMining ? (
                        <div className="flex flex-col items-center">
                            <Activity size={18} className={`${turboActive ? 'text-[#FF0000]' : 'text-primary'} animate-pulse mb-1 drop-shadow-[0_0_8px_rgba(255,0,0,0.8)]`} />
                            <span className="text-3xl font-mono font-black text-white tabular-nums leading-none mb-1">{Math.floor(Math.max(0, displayEnergy)) || 0}</span>
                            <span className="text-lg font-mono text-white/20 uppercase font-black">/ {maxEnergy}</span>
                            {turboActive && <span className="text-[9px] font-mono font-black text-[#FF0000] uppercase mt-1 animate-pulse tracking-widest drop-shadow-[0_0_8px_rgba(255,0,0,0.8)]">⚡ TURBO x2</span>}
                        </div>
                    ) : (
                        <Zap size={44} className={energy <= 0 ? "text-[#1A1A1A] fill-current" : "text-[#222] fill-current"} />
                    )}
                 </button>
             </div>

             <div className="absolute bottom-8 left-8 right-8 z-30 flex items-center justify-center">
                <div className="flex items-center gap-3 p-2 bg-black/60 border border-white/5 rounded-[24px] backdrop-blur-md">
                    <button onClick={() => !autoMining && onOpenPayment('autobot')} className={`relative w-10 h-10 rounded-xl flex items-center justify-center active:scale-90 ${autoMining ? 'bg-green-500/20 border border-green-500/40 text-green-400' : 'bg-[#111] border border-[#222] text-primary/40'}`}>
                        <RefreshCw size={16} className={autoMining ? 'animate-spin' : ''} />
                        {autoMining && <span className="absolute -top-1 -right-1 text-[6px] font-mono font-black bg-green-500 text-black px-1 rounded">ON</span>}
                    </button>
                    <button onClick={() => !turboActive && onOpenPayment('multitap')} className={`relative w-16 h-12 rounded-2xl flex items-center justify-center active:scale-95 ${turboActive ? 'bg-black border border-primary/40 text-primary shadow-glow-orange' : 'bg-black border border-primary/40 text-primary shadow-glow-orange'}`}>
                        <Rocket size={24} fill="currentColor" />
                        {turboActive && <span className="absolute -top-1 -right-1 text-[6px] font-mono font-black bg-primary text-black px-1 rounded">x2</span>}
                    </button>
                    <button onClick={() => onOpenPayment('energy')} className="w-10 h-10 rounded-xl bg-[#111] border border-[#222] flex items-center justify-center text-primary/40 active:scale-90"><Battery size={16} /></button>
                </div>
             </div>
         </div>

         {/* Extracted Blocks (Clean Feed - 5 Blocks) */}
         <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-[32px] p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between px-1 mb-1">
                <div className="flex items-center gap-2">
                    <Layers size={12} className="text-primary" />
                    <span className="text-[10px] font-mono font-black text-[#333] uppercase tracking-widest">Extraction_Logs</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-[8px] font-mono text-green-500/60 font-black uppercase">Grid_Live</span>
                </div>
            </div>
            <div className="flex flex-col gap-3">
                {blocks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Box size={24} className="text-[#222] mb-2" />
                        <span className="text-[10px] font-mono text-[#333] uppercase font-bold">Awaiting extraction data...</span>
                    </div>
                )}
                {blocks.slice(0, 6).map((block, i) => {
                    const isNew = newBlockIds.has(block.id) || (i === 0 && blocks.length <= 6);
                    const isFresh = newBlockIds.has(block.id);
                    const timeAgo = formatTimeAgo(block.createdAt);

                    return (
                        <div 
                        key={block.id} 
                        onClick={() => onOpenBlockDetail({ 
                            id: `BLOCK_${block.id}`, 
                            finder: block.finder, 
                            hash: block.hash, 
                            difficulty: block.difficulty, 
                            reward: block.reward, 
                            participants: block.participants, 
                            timestamp: timeAgo 
                        })}
                        className={`bg-black/40 border border-[#1A1A1A] rounded-[24px] p-4 flex items-center justify-between active:scale-[0.98] transition-all duration-500 cursor-pointer group ${isNew ? 'border-primary/20 shadow-[0_0_15px_rgba(255,59,0,0.05)]' : ''} ${isFresh ? 'animate-slide-down' : ''}`}
                        
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-2xl bg-[#0A0A0A] border border-[#222] flex items-center justify-center group-hover:border-primary/40 transition-colors ${isNew ? 'border-primary/30' : ''}`}>
                                    <Box size={18} className={isNew ? "text-primary animate-pulse" : "text-[#222]"} />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[12px] font-mono font-black uppercase tracking-tighter ${isNew ? 'text-white' : 'text-white/40'}`}>
                                            #{block.id}
                                        </span>
                                        {isNew && <span className="text-[7px] bg-primary text-black px-1.5 py-0.5 rounded font-black uppercase italic tracking-tighter animate-pulse">NEW</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-mono text-[#444] font-bold uppercase">HASH: {block.hash.slice(0, 4)}...{block.hash.slice(-3)}</span>
                                        <span className="text-[9px] font-mono text-[#333] font-bold uppercase">• {timeAgo}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className={`text-base font-mono font-black ${isNew ? 'text-primary' : 'text-white/20'}`}>+{block.reward.toFixed(2)}</span>
                                <span className="text-[8px] font-mono text-primary/30 block leading-none mt-0.5">PUREX</span>
                            </div>
                        </div>
                    );
                })}
            </div>
         </div>
      </div>
    </div>
  );
};
