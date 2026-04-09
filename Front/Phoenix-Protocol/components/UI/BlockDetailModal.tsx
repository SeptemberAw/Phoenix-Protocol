
import React, { useState, useEffect } from 'react';
import { X, Box, Activity, Share2, Globe, Cpu, Binary, Fingerprint, ShieldAlert, Zap } from 'lucide-react';
import { MinedBlock } from '../../types';

interface BlockDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  block: MinedBlock | null;
}

export const BlockDetailModal: React.FC<BlockDetailModalProps> = ({ isOpen, onClose, block }) => {
  const [procData, setProcData] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      const interval = setInterval(() => {
        const hex = Array.from({ length: 4 }).map(() => Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0')).join('');
        setProcData(prev => [hex, ...prev].slice(0, 6));
      }, 150);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen || !block) return null;

  // Extract clean ID number from "BLOCK_XXXX" format
  const cleanId = block.id.replace('BLOCK_', '');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-md transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-sm bg-[#080808] border border-[#333] rounded-[32px] p-6 animate-scale-up overflow-hidden shadow-[0_0_60px_rgba(255,59,0,0.2)]">
        {/* Background Grids */}
        <div className="absolute inset-0 bg-noise opacity-10 pointer-events-none"></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-primary/30"></div>

        {/* Content */}
        <div className="relative z-10 flex flex-col">
            <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#111] border border-[#222] flex items-center justify-center text-primary relative shadow-[inset_0_0_10px_rgba(255,59,0,0.1)]">
                        <Box size={24} />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#080808] animate-pulse"></div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-[#555] font-mono font-bold uppercase tracking-widest">Neural_Block</span>
                        <h2 className="text-3xl font-black text-white uppercase tracking-tighter">#{cleanId}</h2>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 bg-[#111] border border-[#222] rounded-full hover:bg-white/5 transition-colors">
                    <X size={18} className="text-gray-500" />
                </button>
            </div>

            {/* Neural Processing Terminal (The "Sexy" Part) */}
            <div className="bg-black/80 border border-[#222] rounded-[24px] p-5 mb-6 relative overflow-hidden shadow-inner">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                        <span className="text-[9px] font-mono font-black text-primary uppercase tracking-[0.2em]">Neural_Visualizer</span>
                    </div>
                    <span className="text-[8px] font-mono text-[#555] bg-[#111] px-1.5 py-0.5 rounded border border-[#222] font-bold">v2.1.0-STABLE</span>
                </div>
                
                <div className="grid grid-cols-2 gap-6 h-32 overflow-hidden font-mono text-[10px]">
                    {/* Left Column: Hex Stream */}
                    <div className="flex flex-col gap-1.5 opacity-50 border-r border-white/5 pr-2">
                        {procData.map((hex, i) => (
                            <div key={i} className="flex justify-between items-center text-[#555]">
                                <span className="font-mono">0x{hex}</span>
                                <span className="text-[8px] text-primary/40 font-bold">[OK]</span>
                            </div>
                        ))}
                    </div>

                    {/* Right Column: Status Indicators (Centered & Spaced) */}
                    <div className="flex flex-col items-center justify-center gap-3 pl-1">
                        <div className="flex gap-2 text-2xl font-black text-[#222] tracking-tighter leading-none select-none opacity-80">
                            <span>01</span>
                            <span>10</span>
                        </div>
                        
                        <div className="flex flex-col items-center gap-1">
                             <Binary size={14} className="text-primary/40" />
                             <span className="text-[8px] text-[#666] uppercase text-center font-bold tracking-wider leading-tight">Consensus<br/>Validated</span>
                        </div>

                        <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-3 py-1 rounded-full mt-1">
                            <div className="w-1 h-1 bg-primary rounded-full animate-ping"></div>
                            <span className="text-[8px] font-mono text-primary font-black uppercase tracking-tight">Streaming_Data</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tactical Grid Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-[#111] p-4 rounded-2xl border border-[#222] flex flex-col gap-1">
                    <span className="text-[9px] text-[#555] font-mono font-bold uppercase">Operator_Node</span>
                    <span className="text-sm font-bold text-white uppercase truncate">{block.finder}</span>
                </div>
                <div className="bg-[#111] p-4 rounded-2xl border border-[#222] flex flex-col gap-1">
                    <span className="text-[9px] text-[#555] font-mono font-bold uppercase">Difficulty_Scale</span>
                    <span className="text-sm font-bold text-primary uppercase">{block.difficulty}</span>
                </div>
                <div className="bg-[#111] p-4 rounded-2xl border border-[#222] flex flex-col gap-1">
                    <span className="text-[9px] text-[#555] font-mono font-bold uppercase">Participant_Load</span>
                    <span className="text-sm font-bold text-white uppercase">{block.participants} NODES</span>
                </div>
                <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20 flex flex-col gap-1 shadow-[0_0_15px_rgba(255,59,0,0.05)]">
                    <span className="text-[9px] text-primary/70 font-mono font-bold uppercase">Net_Reward</span>
                    <span className="text-sm font-bold text-primary uppercase">+{block.reward} PUREX</span>
                </div>
            </div>

            {/* Protocol Signature */}
            <div className="w-full py-4 border-t border-[#222] flex items-center justify-between mt-auto">
                <div className="flex items-center gap-2">
                    <Fingerprint size={16} className="text-[#333]" />
                    <div className="flex flex-col">
                        <span className="text-[8px] font-mono text-[#444] uppercase font-bold">Block_Hash_Sig</span>
                        <span className="text-[10px] font-mono text-white/40 uppercase tracking-tighter truncate max-w-[120px]">{block.hash}...{cleanId}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-[#111] px-3 py-1.5 rounded-full border border-[#222]">
                    <Zap size={10} className="text-primary fill-primary" />
                    <span className="text-[9px] font-mono font-bold text-white uppercase">Finalized</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
