
import React, { useMemo, useState } from 'react';
import { Zap, Battery, Cpu, RefreshCw, ShoppingBag, Sparkles, TrendingUp, ArrowUpCircle, ChevronDown, Info, AlertOctagon, Trophy, BarChart3, ShieldCheck } from 'lucide-react';
import { UpgradeItem } from '../../types';

interface ShopTabProps {
  upgrades: UpgradeItem[];
  balance: number;
  generation: number;
  onUpgrade: (upgradeId: string) => void;
  onAscend: () => void;
}

export const ShopTab: React.FC<ShopTabProps> = ({ upgrades, balance, generation, onUpgrade, onAscend }) => {
  const [isBayInfoExpanded, setIsBayInfoExpanded] = useState(false);
  const [clickingId, setClickingId] = useState<string | null>(null);

  const isAllMaxed = useMemo(() => upgrades.every(u => u.currentLevel >= u.maxLevel), [upgrades]);
  
  const tierInfo = useMemo(() => {
    const cycle = ((generation - 1) % 5) + 1;
    const roman = ["I", "II", "III", "IV", "V"][cycle - 1];
    let color = "text-primary";
    let bg = "bg-primary/10";
    let border = "border-primary/30";
    let glow = "shadow-glow-orange";
    
    if (generation > 10) { 
        color = "text-purple-500"; bg = "bg-purple-500/10"; border = "border-purple-500/30"; glow = "shadow-[0_0_15px_rgba(168,85,247,0.4)]";
    } else if (generation > 5) { 
        color = "text-cyan-400"; bg = "bg-cyan-400/10"; border = "border-cyan-400/30"; glow = "shadow-[0_0_15px_rgba(34,211,238,0.4)]";
    }
    
    return { roman, color, bg, border, glow };
  }, [generation]);

  const totalLevels = useMemo(() => upgrades.reduce((acc, curr) => acc + curr.currentLevel, 0), [upgrades]);
  const maxPossibleLevels = useMemo(() => upgrades.reduce((acc, curr) => acc + curr.maxLevel, 0), [upgrades]);
  const progressToAscension = (totalLevels / maxPossibleLevels) * 100;

  const handleUpgradeClick = (id: string) => {
    setClickingId(id);
    onUpgrade(id);
    setTimeout(() => setClickingId(null), 300);
  };

  const getUpgradeImpact = (item: UpgradeItem) => {
    switch(item.category) {
        case 'mining': return { label: 'Speed', icon: BarChart3 };
        case 'energy': return { label: 'Capacity', icon: Battery };
        case 'recharge': return { label: 'Regen', icon: RefreshCw };
        case 'passive': return { label: 'Passive', icon: ShieldCheck };
        default: return { label: 'Impact', icon: Zap };
    }
  };

  return (
    <div className="flex flex-col w-full pt-2 gap-4 pb-24">
      {/* Ascension Block / Detailed Info */}
      {isAllMaxed ? (
        <div className="bg-gradient-to-br from-[#FF3B00] to-[#FF8A00] rounded-[32px] p-8 relative overflow-hidden shadow-[0_0_50px_rgba(255,59,0,0.4)] animate-pulse">
            <div className="absolute inset-0 bg-noise opacity-20"></div>
            <div className="relative z-10 flex flex-col items-center text-center">
                <ArrowUpCircle size={40} className="text-black mb-4 animate-bounce" />
                <h2 className="text-3xl font-black text-black uppercase tracking-tighter leading-none mb-2">Ascension READY</h2>
                <p className="text-sm font-mono text-black/70 font-bold uppercase mb-6 leading-tight">
                    Evolve node to next generation tier.<br/>
                    All hardware will be <span className="text-black">Reset</span> for permanent power gain.
                </p>
                <button 
                    onClick={onAscend}
                    className="w-full h-16 bg-black text-white font-sans font-black text-lg uppercase rounded-2xl active:scale-95 transition-all shadow-2xl"
                >
                    Initiate Evolution
                </button>
            </div>
        </div>
      ) : (
        <div 
          onClick={() => setIsBayInfoExpanded(!isBayInfoExpanded)}
          className="bg-[#111] rounded-[32px] p-6 border border-[#222] relative overflow-hidden group shadow-hard cursor-pointer hover:border-primary/20 transition-all"
        >
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className={`flex items-center gap-2 ${tierInfo.bg} ${tierInfo.border} ${tierInfo.glow} border px-3 py-1 rounded-full`}>
                        <TrendingUp size={10} className={tierInfo.color} />
                        <span className={`text-[10px] font-mono font-black uppercase tracking-widest ${tierInfo.color}`}>GEN_{tierInfo.roman} Protocol</span>
                    </div>
                    <ChevronDown size={14} className={`text-[#333] transition-transform duration-500 ${isBayInfoExpanded ? 'rotate-180' : ''}`} />
                </div>
                
                <div className="flex items-end justify-between mb-2">
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">Upgrade Bay</h2>
                    <div className="text-right">
                        <span className="text-[9px] font-mono text-[#444] uppercase font-bold block mb-1">Node_Saturation</span>
                        <span className="text-xl font-mono font-black text-primary">{Math.floor(progressToAscension)}%</span>
                    </div>
                </div>

                <div className="mt-4 w-full h-2 bg-black rounded-full overflow-hidden border border-white/5 p-[1px]">
                    <div className="h-full bg-primary shadow-glow-orange transition-all duration-1000 rounded-full" style={{ width: `${progressToAscension}%` }}></div>
                </div>

                <div className={`overflow-hidden transition-all duration-500 ${isBayInfoExpanded ? 'max-h-[800px] opacity-100 mt-6' : 'max-h-0 opacity-0'}`}>
                    <div className="flex flex-col gap-4 pt-5 border-t border-white/5">
                        <div className="grid grid-cols-1 gap-3">
                            <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-2 text-primary mb-2">
                                    <Info size={14} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Protocol Intelligence</span>
                                </div>
                                <p className="text-[10px] font-mono text-[#666] uppercase leading-relaxed font-bold">
                                    Upgrading hardware directly influences extraction density. 
                                    Speed increases CH/s, Capacity expands Energy buffer, Regen accelerates recovery. 
                                    Reaching 100% saturation triggers Ascension.
                                </p>
                            </div>

                            <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-2 text-white mb-3">
                                    <BarChart3 size={14} className="text-primary" />
                                    <span className="text-[10px] font-black uppercase tracking-tight">Generation Hierarchy</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-[8px] font-mono uppercase font-black">
                                    <div className="bg-primary/10 border border-primary/20 p-2.5 rounded-xl text-primary text-center">
                                        <div>Tiers I-V</div>
                                        <div className="opacity-40 italic text-[7px] mt-0.5">COMMON</div>
                                    </div>
                                    <div className="bg-cyan-500/10 border border-cyan-500/20 p-2.5 rounded-xl text-cyan-400 text-center">
                                        <div>Tiers VI-X</div>
                                        <div className="opacity-40 italic text-[7px] mt-0.5">ELITE</div>
                                    </div>
                                    <div className="bg-purple-500/10 border border-purple-500/20 p-2.5 rounded-xl text-purple-500 text-center">
                                        <div>Tiers XI-XV</div>
                                        <div className="opacity-40 italic text-[7px] mt-0.5">MYTHIC</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Upgrades List */}
      <div className="flex flex-col gap-3">
        {upgrades.map((item) => {
          const cost = Math.floor(item.baseCost * Math.pow(2, generation - 1) * Math.pow(item.costMultiplier, item.currentLevel));
          const canAfford = balance >= cost;
          const isMaxLevel = item.currentLevel >= item.maxLevel;
          const isClicking = clickingId === item.id;
          const impact = getUpgradeImpact(item);

          return (
            <div 
                key={item.id} 
                className={`p-5 rounded-[28px] border transition-all relative overflow-hidden flex flex-col gap-4
                    ${isMaxLevel ? 'bg-black border-primary/20 opacity-80' : 'bg-[#161616] border-[#222] hover:border-primary/20'}
                    ${isClicking ? 'scale-[0.97]' : 'scale-100'}
                `}
            >
              {/* Buy Flash Effect */}
              <div className={`absolute inset-0 bg-primary/10 transition-opacity duration-300 pointer-events-none ${isClicking ? 'opacity-100' : 'opacity-0'}`}></div>
              
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${isMaxLevel ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-[#0A0A0A] border-[#333] text-[#444]'}`}>
                    {item.category === 'energy' ? <Battery size={24} /> : item.category === 'mining' ? <Cpu size={24} /> : <Zap size={24} />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base font-black text-white uppercase tracking-tight">{item.name}</span>
                    <div className="flex items-center gap-1.5 mt-1">
                        <impact.icon size={10} className="text-primary/60" />
                        <span className="text-[9px] font-mono text-[#555] font-black uppercase tracking-widest">{impact.label}_Enhancement</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                    <span className={`text-[11px] font-mono font-black uppercase ${isMaxLevel ? 'text-primary' : 'text-white/20'}`}>
                        {isMaxLevel ? 'MAX' : `LVL ${item.currentLevel}/${item.maxLevel}`}
                    </span>
                </div>
              </div>

              {/* Purchase Dots / Progress */}
              <div className="flex gap-1 relative z-10">
                {Array.from({ length: item.maxLevel }).map((_, i) => (
                    <div 
                        key={i} 
                        className={`h-1 flex-1 rounded-full transition-all duration-500 ${i < item.currentLevel ? 'bg-primary shadow-[0_0_5px_#FF3B00]' : 'bg-[#222]'}`}
                    />
                ))}
              </div>
              
              {!isMaxLevel && (
                <div className="flex items-center justify-between mt-1 relative z-10">
                    <div className="flex items-center gap-2 bg-black/50 px-3 py-2 rounded-xl border border-white/5">
                        <Zap size={14} className="text-primary fill-primary" />
                        <span className={`text-sm font-mono font-black ${canAfford ? 'text-white' : 'text-red-500'}`}>
                            {new Intl.NumberFormat('en-US').format(cost)}
                        </span>
                    </div>
                    <button 
                        disabled={!canAfford} 
                        onClick={() => handleUpgradeClick(item.id)}
                        className={`px-8 h-12 rounded-xl font-sans font-black text-[11px] uppercase transition-all active:scale-95 
                            ${canAfford ? 'bg-primary text-black shadow-glow-orange hover:bg-white' : 'bg-[#1A1A1A] text-[#444] cursor-not-allowed'}
                        `}
                    >
                        {canAfford ? 'Upgrade' : 'Insuf_Credits'}
                    </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
