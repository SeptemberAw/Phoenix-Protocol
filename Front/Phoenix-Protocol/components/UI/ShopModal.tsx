
import React, { useMemo, useState } from 'react';
import { X, Zap, Battery, Cpu, RefreshCw, ShoppingBag, TrendingUp, ArrowUpCircle, ChevronDown, Info, BarChart3, ShieldCheck, Binary, Star, ZapOff, Layers } from 'lucide-react';
import { UpgradeItem } from '../../types';

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  upgrades: UpgradeItem[];
  balance: number;
  generation: number;
  onUpgrade: (upgradeId: string) => void;
  onUpgradeMax: () => void;
  onAscend: () => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({ isOpen, onClose, upgrades, balance, generation, onUpgrade, onUpgradeMax, onAscend }) => {
  const [isBayInfoExpanded, setIsBayInfoExpanded] = useState(false);
  const [clickingId, setClickingId] = useState<string | null>(null);

  const isAllMaxed = useMemo(() => upgrades.every(u => u.currentLevel >= u.maxLevel), [upgrades]);
  const totalLevels = useMemo(() => upgrades.reduce((acc, curr) => acc + curr.currentLevel, 0), [upgrades]);
  const maxPossibleLevels = useMemo(() => upgrades.reduce((acc, curr) => acc + curr.maxLevel, 0), [upgrades]);
  const progressToAscension = (totalLevels / maxPossibleLevels) * 100;

  const tierInfo = useMemo(() => {
    const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"][generation - 1] || "I";
    let color = "text-primary";
    let bg = "bg-primary/10";
    let border = "border-primary/30";
    let tierName = "Common";
    
    if (generation > 10) { 
        color = "text-purple-500"; bg = "bg-purple-500/10"; border = "border-purple-500/30";
        tierName = "Mythic";
    } else if (generation > 5) { 
        color = "text-cyan-400"; bg = "bg-cyan-400/10"; border = "border-cyan-400/30";
        tierName = "Elite";
    }
    
    return { roman, color, bg, border, tierName };
  }, [generation]);

  const handleUpgradeClick = (id: string) => {
    setClickingId(id);
    onUpgrade(id);
    setTimeout(() => setClickingId(null), 300);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative w-full max-w-sm bg-[#080808] border border-[#222] rounded-[40px] p-6 shadow-2xl animate-scale-up overflow-hidden flex flex-col max-h-[85vh]">
        <div className="absolute inset-0 bg-noise opacity-10 pointer-events-none"></div>

        <div className="flex justify-between items-center mb-6 relative z-10">
            <h2 className="text-xl font-black text-white uppercase flex items-center gap-2 font-sans italic tracking-tighter">
                <ShoppingBag size={20} className="text-primary" /> Upgrade Bay
            </h2>
            <button onClick={onClose} className="p-2 bg-[#111] border border-[#222] rounded-full hover:bg-[#222]">
                <X size={16} className="text-white" />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-4">
            {isAllMaxed ? (
                <div className="bg-gradient-to-br from-[#FF3B00] to-[#FF8A00] rounded-[32px] p-8 text-center animate-pulse relative group border border-primary/50 shadow-glow-orange">
                    <div className="absolute inset-0 bg-noise opacity-20 pointer-events-none"></div>
                    <ArrowUpCircle size={40} className="text-black mx-auto mb-4 animate-bounce" />
                    <h2 className="text-3xl font-black text-black uppercase mb-4 italic tracking-tighter">Evolution Pending</h2>
                    <p className="text-[10px] font-mono text-black/60 font-black uppercase mb-6 leading-tight">
                        Hardware saturated. Initiate Ascension protocol to breach G{generation + 1}.0 {tierInfo.tierName} tier.
                    </p>
                    <button 
                        onClick={onAscend} 
                        className="w-full h-16 bg-black text-white font-black uppercase rounded-2xl active:scale-90 transition-all shadow-2xl flex items-center justify-center gap-3 group"
                    >
                        <Zap size={18} className="text-primary fill-primary" />
                        Ascend to G{generation + 1}
                    </button>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    <div 
                        onClick={() => setIsBayInfoExpanded(!isBayInfoExpanded)}
                        className="bg-[#111] rounded-[28px] p-5 border border-[#222] cursor-pointer group hover:border-primary/30 transition-all shadow-hard"
                    >
                        <div className="flex justify-between items-center mb-4">
                            <div className={`flex items-center gap-2 ${tierInfo.bg} ${tierInfo.border} px-3 py-1 rounded-full`}>
                                <Binary size={12} className={tierInfo.color} />
                                <span className={`text-[9px] font-mono font-black uppercase tracking-widest ${tierInfo.color}`}>GEN_{tierInfo.roman} [{tierInfo.tierName}]</span>
                            </div>
                            <ChevronDown size={14} className={`text-[#333] transition-transform duration-500 ${isBayInfoExpanded ? 'rotate-180' : ''}`} />
                        </div>
                        
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-[9px] font-mono text-[#444] uppercase font-black tracking-widest">Saturation</span>
                            <span className="text-xl font-mono font-black text-primary">{Math.floor(progressToAscension)}%</span>
                        </div>
                        <div className="w-full h-2 bg-black rounded-full overflow-hidden border border-white/5">
                            <div className="h-full bg-primary shadow-glow-orange transition-all duration-1000" style={{ width: `${progressToAscension}%` }}></div>
                        </div>

                        <div className={`overflow-hidden transition-all duration-500 ${isBayInfoExpanded ? 'max-h-[800px] opacity-100 mt-6' : 'max-h-0 opacity-0'}`}>
                            <div className="flex flex-col gap-4 pt-5 border-t border-white/5">
                                <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-2 text-primary mb-2">
                                        <Info size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Evolution Data</span>
                                    </div>
                                    <p className="text-[10px] font-mono text-[#666] uppercase leading-relaxed font-bold">
                                        Ascension сбрасывает уровни железа, но навсегда повышает <span className="text-white">Базовый Множитель</span> и <span className="text-white">Лимит Риска</span>.
                                    </p>
                                </div>

                                <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-2 text-white mb-3">
                                        <BarChart3 size={14} className="text-primary" />
                                        <span className="text-[10px] font-black uppercase tracking-tight">Generation Tiers</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-[8px] font-mono uppercase font-black">
                                        <div className="bg-primary/10 border border-primary/20 p-2.5 rounded-xl text-primary text-center">
                                            <div>G I-V</div>
                                            <div className="opacity-40 italic text-[7px] mt-0.5 uppercase">Common</div>
                                        </div>
                                        <div className="bg-cyan-500/10 border border-cyan-500/20 p-2.5 rounded-xl text-cyan-400 text-center">
                                            <div>G VI-X</div>
                                            <div className="opacity-40 italic text-[7px] mt-0.5 uppercase">Elite</div>
                                        </div>
                                        <div className="bg-purple-500/10 border border-purple-500/20 p-2.5 rounded-xl text-purple-500 text-center">
                                            <div>G XI-XV</div>
                                            <div className="opacity-40 italic text-[7px] mt-0.5 uppercase">Mythic</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                                    </div>
            )}

            <div className="flex flex-col gap-3 pb-4">
                {upgrades.map((item) => {
                    const cost = Math.floor(item.baseCost * Math.pow(2, generation - 1) * Math.pow(item.costMultiplier, item.currentLevel));
                    const canAfford = balance >= cost;
                    const isMaxLevel = item.currentLevel >= item.maxLevel;
                    const isClicking = clickingId === item.id;

                    return (
                        <div key={item.id} className={`p-4 rounded-[28px] border transition-all duration-300 relative overflow-hidden ${isMaxLevel ? 'bg-black border-primary/20 opacity-70' : 'bg-[#161616] border-[#222] hover:border-primary/20'}`}>
                            {isClicking && <div className="absolute inset-0 bg-primary/10 animate-pulse pointer-events-none" />}
                            
                            <div className="flex items-center gap-4 mb-4">
                                <div className={`w-12 h-12 rounded-xl bg-[#0A0A0A] border border-[#333] flex items-center justify-center text-primary ${isMaxLevel ? 'shadow-glow-orange border-primary/30' : ''}`}>
                                    {item.category === 'energy' ? <Battery size={20} /> : item.category === 'mining' ? <Cpu size={20} /> : <Zap size={20} />}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-black text-white uppercase italic tracking-tighter">{item.name}</span>
                                    <span className="text-[8px] font-mono text-[#444] uppercase tracking-widest">Level {item.currentLevel}/{item.maxLevel}</span>
                                </div>
                            </div>
                            
                            {!isMaxLevel && (
                                <button 
                                    disabled={!canAfford} 
                                    onClick={() => handleUpgradeClick(item.id)}
                                    className={`w-full h-12 rounded-2xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2 active:scale-95 ${
                                        canAfford ? 'bg-primary text-black shadow-glow-orange' : 'bg-[#1A1A1A] text-[#444] cursor-not-allowed'
                                    }`}
                                >
                                    {canAfford ? (
                                        <>
                                            <Zap size={10} fill="black" />
                                            Upgrade ({new Intl.NumberFormat('en-US').format(cost)})
                                        </>
                                    ) : (
                                        <>
                                            <ZapOff size={10} />
                                            Credits Required
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    </div>
  );
};
