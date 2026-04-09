
import React from 'react';
import { X, Trophy, Zap, Shield, Target, Crown, Award } from 'lucide-react';

interface LeagueInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLeague: string;
}

const LEAGUES = [
  { name: 'Master', range: '#1 - #10', bonus: 'x3.0 Multiplier', icon: Crown, color: 'text-yellow-500' },
  { name: 'Diamond', range: '#11 - #100', bonus: 'x2.0 Multiplier', icon: Award, color: 'text-blue-400' },
  { name: 'Platinum', range: '#101 - #500', bonus: 'x1.5 Multiplier', icon: Shield, color: 'text-indigo-400' },
  { name: 'Gold', range: '#501 - #1,000', bonus: 'x1.25 Multiplier', icon: Target, color: 'text-orange-400' },
  { name: 'Silver', range: '#1,001 - #5,000', bonus: 'x1.1 Multiplier', icon: Zap, color: 'text-gray-300' },
  { name: 'Bronze', range: '#5,000+', bonus: 'x1.0 Multiplier', icon: Trophy, color: 'text-amber-700' },
];

export const LeagueInfoModal: React.FC<LeagueInfoModalProps> = ({ isOpen, onClose, currentLeague }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-sm bg-[#080808] border border-[#222] rounded-[32px] p-5 shadow-2xl animate-scale-up overflow-hidden flex flex-col max-h-[80vh]">
        <div className="absolute inset-0 bg-noise opacity-10 pointer-events-none"></div>

        <div className="flex justify-between items-center mb-4 relative z-10">
            <h2 className="text-lg font-sans font-bold text-white uppercase flex items-center gap-2">
                <Trophy size={18} className="text-primary" /> Multiplier Protocol
            </h2>
            <button onClick={onClose} className="p-1.5 bg-[#111] border border-[#222] rounded-full hover:bg-[#222]">
                <X size={14} className="text-white" />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
            {LEAGUES.map((league) => {
                const isActive = currentLeague.toLowerCase() === league.name.toLowerCase();
                const Icon = league.icon;
                
                return (
                    <div 
                        key={league.name}
                        className={`
                            relative p-3 rounded-xl border transition-all
                            ${isActive 
                                ? 'bg-primary/5 border-primary/40 shadow-[0_0_15px_rgba(255,59,0,0.1)]' 
                                : 'bg-[#0D0D0D] border-[#222]'}
                        `}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg bg-[#111] border border-[#222] flex items-center justify-center ${league.color}`}>
                                    <Icon size={16} />
                                </div>
                                <div className="flex flex-col">
                                    <span className={`font-bold font-sans uppercase text-xs ${isActive ? 'text-white' : 'text-gray-400'}`}>
                                        {league.name}
                                    </span>
                                    <span className="text-[8px] font-mono text-[#555]">{league.range}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className={`text-[10px] font-bold font-mono ${isActive ? 'text-primary' : 'text-white'}`}>
                                    {league.bonus}
                                </span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
        
        <div className="mt-4 pt-3 border-t border-[#222]">
            <p className="text-[9px] font-mono text-[#555] uppercase text-center leading-tight">
                Higher leagues grant permanent passive boosts to all mining operations.
            </p>
        </div>
      </div>
    </div>
  );
};
