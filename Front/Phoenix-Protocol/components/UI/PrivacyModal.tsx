
import React, { useState } from 'react';
import { Shield, Check, Terminal, ChevronRight, Scale, Activity, Lock, ExternalLink } from 'lucide-react';

interface PrivacyModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onAccept }) => {
  const [accepted, setAccepted] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/98 backdrop-blur-3xl" />
      
      <div className="relative w-full max-w-sm bg-[#080808] border border-white/5 rounded-[32px] p-6 flex flex-col shadow-2xl animate-scale-up overflow-hidden">
        <div className="absolute inset-0 bg-noise opacity-[0.03] pointer-events-none"></div>
        
        <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 shadow-[inset_0_0_10px_rgba(255,59,0,0.1)]">
                <Shield size={24} />
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-3">Neural Access</h2>
            <div className="flex items-center gap-2 mb-2 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                <Terminal size={8} className="text-primary" />
                <span className="text-[7px] font-mono font-black text-white/40 uppercase tracking-[0.2em]">Safety_Uplink_v3.1</span>
            </div>
        </div>

        <div className="flex-1 mb-6">
            <div className="space-y-2">
                {/* Compact bullet points */}
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                        <Activity size={10} className="text-primary" />
                        <span className="text-[9px] font-black text-white uppercase tracking-widest">Test Network</span>
                    </div>
                    <p className="text-[9px] font-mono text-[#555] leading-snug uppercase">
                        This is a Beta sandbox. All interactions are for stress-testing the neural core only.
                    </p>
                </div>

                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                        <Lock size={10} className="text-primary" />
                        <span className="text-[9px] font-black text-white uppercase tracking-widest">Privacy</span>
                    </div>
                    <p className="text-[9px] font-mono text-[#555] leading-snug uppercase">
                        No personal data stored. Node identification is device-based for hash sync.
                    </p>
                </div>

                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                        <Scale size={10} className="text-primary" />
                        <span className="text-[9px] font-black text-white uppercase tracking-widest">Liability</span>
                    </div>
                    <p className="text-[9px] font-mono text-[#555] leading-snug uppercase">
                        Participation is voluntary. No financial guarantees or fixed token values.
                    </p>
                </div>
            </div>
        </div>

        {/* External Link */}
        <div className="mb-6 flex justify-center">
            <button 
                onClick={() => window.open('https://t.me/purexprotocol', '_blank')}
                className="text-[8px] font-mono text-[#444] hover:text-white transition-colors border-b border-[#222] hover:border-white/20 pb-0.5 flex items-center gap-1 uppercase font-bold"
            >
                View Full Network Terms & Policy <ExternalLink size={8} />
            </button>
        </div>

        <div className="flex flex-col gap-4">
            <label className="flex items-start gap-3 cursor-pointer group">
                <div 
                    onClick={() => setAccepted(!accepted)}
                    className={`mt-0.5 w-5 h-5 rounded-md border-2 flex shrink-0 items-center justify-center transition-all ${accepted ? 'bg-primary border-primary shadow-glow-orange' : 'border-white/10 bg-white/5 group-hover:border-primary/50'}`}
                >
                    {accepted && <Check size={14} className="text-black" strokeWidth={3} />}
                </div>
                <span className="text-[9px] font-mono text-[#666] uppercase font-bold tracking-tight leading-snug">
                    I confirm my participation in testing and accept all protocol terms.
                </span>
            </label>

            <button 
                disabled={!accepted}
                onClick={onAccept}
                className={`w-full h-12 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${accepted ? 'bg-white text-black shadow-glow-white active:scale-95' : 'bg-white/5 text-[#222] cursor-not-allowed'}`}
            >
                Connect to Network
            </button>
        </div>
      </div>
    </div>
  );
};
