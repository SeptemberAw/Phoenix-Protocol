
import React, { useState } from 'react';
import { X, Wallet, ShieldCheck, Lock, ChevronRight, Globe, LifeBuoy, FileText, Map, Unplug, Ticket, Check } from 'lucide-react';
import { useTonPayment } from '../../hooks/useTonPayment';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { isWalletConnected, walletAddress, connectWallet, doDisconnectWallet } = useTonPayment();
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState<'idle' | 'success' | 'error'>('idle');

  if (!isOpen) return null;

  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-sm max-h-[90vh] bg-[#121212] border border-[#333] rounded-[24px] p-6 animate-scale-up overflow-y-auto shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="absolute inset-0 bg-noise opacity-5 pointer-events-none"></div>
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
            <div className="flex flex-col">
                <span className="text-[9px] font-mono text-primary font-bold uppercase tracking-widest mb-0.5">System_Config</span>
                <h2 className="text-xl font-sans font-bold text-white uppercase">User Settings</h2>
            </div>
            <button onClick={onClose} className="p-2 bg-[#222] rounded-full hover:bg-[#333] transition-colors">
                <X size={16} className="text-white" />
            </button>
        </div>

        <div className="flex flex-col gap-4">
            
            {/* Wallet Connect - NOW FIRST */}
            <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#222] relative overflow-hidden group">
                <div className="flex items-center gap-3 mb-3 relative z-10">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${isWalletConnected ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                        <Wallet size={20} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">TON Wallet</span>
                        <span className={`text-[10px] font-mono uppercase font-bold tracking-tight ${isWalletConnected ? 'text-green-500' : 'text-[#555]'}`}>
                            {isWalletConnected ? shortAddr : 'Status: Not Linked'}
                        </span>
                    </div>
                </div>
                {isWalletConnected ? (
                    <button 
                        onClick={() => doDisconnectWallet()}
                        className="w-full h-10 bg-red-600/20 border border-red-500/30 rounded-lg text-xs font-bold uppercase text-red-400 hover:bg-red-600/30 transition-all active:scale-95 relative z-10 flex items-center justify-center gap-2"
                    >
                        <Unplug size={14} />
                        Disconnect Wallet
                    </button>
                ) : (
                    <button 
                        onClick={() => connectWallet()}
                        className="w-full h-10 bg-blue-600 rounded-lg text-xs font-bold uppercase text-white hover:bg-blue-500 transition-all active:scale-95 relative z-10"
                    >
                        Connect Wallet
                    </button>
                )}
                <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Wallet size={40} />
                </div>
            </div>

            {/* Project Roadmap - MOVED DOWN */}
            <a 
              href="https://t.me/purexprotocol" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-primary/10 rounded-xl p-4 border border-primary/20 relative overflow-hidden group flex items-center justify-between"
            >
                <div className="flex items-center gap-3 relative z-10">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_15px_rgba(255,59,0,0.2)]">
                        <Map size={20} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-black text-white uppercase">Neural Roadmap</span>
                        <span className="text-[10px] font-mono text-primary uppercase font-bold tracking-tight">Q3 - Q4 Sync Plan</span>
                    </div>
                </div>
                <ChevronRight size={18} className="text-primary relative z-10 group-hover:translate-x-1 transition-transform" />
                <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Map size={80} />
                </div>
            </a>

            {/* Resources Section */}
            <div className="flex flex-col gap-2 mt-2">
                <span className="text-[9px] font-mono text-[#444] font-bold uppercase tracking-[0.2em] px-1">Resources & Legal</span>
                <div className="grid grid-cols-1 gap-2">
                    <button 
                        onClick={() => window.open('https://t.me/purexprotocol', '_blank')}
                        className="flex items-center justify-between p-3 bg-[#1A1A1A] border border-[#222] rounded-xl hover:border-primary/40 transition-all active:scale-[0.98] group"
                    >
                        <div className="flex items-center gap-3">
                            <Globe size={16} className="text-[#666] group-hover:text-primary transition-colors" />
                            <span className="text-xs font-bold text-[#ccc] uppercase font-sans">Social Networks</span>
                        </div>
                        <span className="text-[8px] font-mono text-[#444] group-hover:text-primary/60 transition-colors uppercase font-bold">@purexprotocol</span>
                    </button>

                    <button 
                        onClick={() => window.open('https://t.me/purex_protocol_supportbot', '_blank')}
                        className="flex items-center justify-between p-3 bg-[#1A1A1A] border border-[#222] rounded-xl hover:border-primary/40 transition-all active:scale-[0.98] group"
                    >
                        <div className="flex items-center gap-3">
                            <LifeBuoy size={16} className="text-[#666] group-hover:text-primary transition-colors" />
                            <span className="text-xs font-bold text-[#ccc] uppercase font-sans">Technical Support</span>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
                    </button>

                    <button 
                        onClick={() => window.open('https://t.me/purexprotocol', '_blank')}
                        className="flex items-center justify-between p-3 bg-[#1A1A1A] border border-[#222] rounded-xl hover:border-primary/40 transition-all active:scale-[0.98] group"
                    >
                        <div className="flex items-center gap-3">
                            <FileText size={16} className="text-[#666] group-hover:text-primary transition-colors" />
                            <span className="text-xs font-bold text-[#ccc] uppercase font-sans">Privacy Policy</span>
                        </div>
                        <ChevronRight size={14} className="text-[#333]" />
                    </button>

                    <button 
                        onClick={() => setShowPromoModal(true)}
                        className="flex items-center justify-between p-3 bg-[#1A1A1A] border border-[#222] rounded-xl hover:border-purple-500/40 transition-all active:scale-[0.98] group"
                    >
                        <div className="flex items-center gap-3">
                            <Ticket size={16} className="text-purple-500/60 group-hover:text-purple-400 transition-colors" />
                            <span className="text-xs font-bold text-[#ccc] uppercase font-sans">Promo Code</span>
                        </div>
                        <ChevronRight size={14} className="text-[#333]" />
                    </button>
                </div>
            </div>

        </div>

        {/* Security Footer */}
        <div className="mt-6 pt-4 border-t border-[#222]">
            <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={14} className="text-primary/60" />
                <span className="text-[10px] font-mono font-bold text-primary/60 uppercase">Encrypted Protocol v2.4</span>
            </div>
            
            <div className="bg-black border border-[#222] p-3 rounded-lg flex items-center gap-3 cursor-pointer hover:border-primary/30 transition-colors group">
                <Lock size={16} className="text-[#333] group-hover:text-primary transition-colors" />
                <div className="flex flex-col overflow-hidden">
                    <span className="text-[9px] text-[#444] uppercase font-mono font-bold tracking-tighter">Session Node Key</span>
                    <span className="text-[10px] text-[#333] font-mono truncate group-hover:text-primary/40 transition-colors">
                        0x7F2...99A1_PROT_SYNC
                    </span>
                </div>
            </div>
        </div>

      </div>

      {/* Promo Code Modal */}
      {showPromoModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => { setShowPromoModal(false); setPromoStatus('idle'); }} />
          <div className="relative w-full max-w-sm bg-[#0A0A0A] border border-purple-500/20 rounded-[28px] p-6 animate-scale-up overflow-hidden shadow-[0_0_40px_rgba(168,85,247,0.1)]">
            <div className="absolute inset-0 bg-noise opacity-5 pointer-events-none" />
            
            <div className="flex justify-between items-center mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 border border-purple-500/20">
                  <Ticket size={20} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">Promo Code</span>
                  <span className="text-[9px] font-mono text-purple-400/50 uppercase font-bold tracking-wider">TON Discount Voucher</span>
                </div>
              </div>
              <button onClick={() => { setShowPromoModal(false); setPromoStatus('idle'); }} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 active:scale-90">
                <X size={14} />
              </button>
            </div>

            <div className="flex gap-2 relative z-10 mb-4">
              <input
                type="text"
                value={promoCode}
                onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoStatus('idle'); }}
                placeholder="ENTER CODE..."
                className="flex-1 h-12 bg-black border border-[#333] rounded-xl px-4 text-sm font-mono text-white placeholder-[#444] uppercase tracking-wider focus:border-purple-500/50 focus:outline-none transition-colors"
              />
              <button 
                onClick={() => { /* TODO: validate promo via API */ }}
                className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center text-white hover:bg-purple-500 transition-all active:scale-95 disabled:opacity-40"
                disabled={!promoCode.trim()}
              >
                <Check size={18} />
              </button>
            </div>

            <p className="text-[10px] font-mono text-[#444] text-center relative z-10">
              Enter a promo code to receive a discount on TON purchases. Codes are distributed via @purexprotocol.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
