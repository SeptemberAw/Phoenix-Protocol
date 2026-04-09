
import React, { useState } from 'react';
import { X, Lock, Check, Star, Radio, Globe, Waves, Cpu, Zap, Network, ShoppingCart, ChevronLeft, Binary, RefreshCw, Triangle, Wallet } from 'lucide-react';
import { NetworkTier } from '../../types';
import { createInvoice, verifyPayment } from '../../api';
import { useTonPayment } from '../../hooks/useTonPayment';

interface NetworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: NetworkTier;
  balance: number;
  onSelect: (tier: NetworkTier) => void;
  telegramId: number;
  onPaymentSuccess?: () => void;
}

const TIER_PAYMENT_MAP: Record<string, string> = {
  'Satellite Grid': 'network_tier_satellite',
  'Quantum Mesh': 'network_tier_quantum',
  'Singularity': 'network_tier_singularity',
};

export const NetworkModal: React.FC<NetworkModalProps> = ({ isOpen, onClose, currentTier, balance, onSelect, telegramId, onPaymentSuccess }) => {
  const [purchasedTiers, setPurchasedTiers] = useState<NetworkTier[]>(['Neural Link']);
  const [showPaymentChoice, setShowPaymentChoice] = useState<NetworkTier | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const { isWalletConnected, connectWallet, payWithTon, isProcessing, tonPrices, starsPrices } = useTonPayment();

  if (!isOpen) return null;

  const tiers: { id: NetworkTier; label: string; speed: string; req: string; type: 'free' | 'buy'; minBalance: number; icon: any; color: string }[] = [
    { id: 'Neural Link', label: 'Neural Link', speed: 'x1.0 Efficiency', req: 'Basic Operator', type: 'free', minBalance: 0, icon: Radio, color: 'text-gray-400' },
    { id: 'Satellite Grid', label: 'Satellite Grid', speed: 'x1.5 Efficiency', req: 'Premium Uplink', type: 'buy', minBalance: 0, icon: Globe, color: 'text-blue-400' },
    { id: 'Quantum Mesh', label: 'Quantum Mesh', speed: 'x2.0 Efficiency', req: '200M Mined', type: 'buy', minBalance: 200000000, icon: Waves, color: 'text-purple-400' },
    { id: 'Singularity', label: 'Singularity', speed: 'x4.0 Efficiency', req: '500M Mined', type: 'buy', minBalance: 500000000, icon: Cpu, color: 'text-primary' },
  ];

  const selectedTierData = tiers.find(t => t.id === showPaymentChoice);
  const paymentType = showPaymentChoice ? TIER_PAYMENT_MAP[showPaymentChoice] || 'network_tier' : '';
  const starsPrice = starsPrices[paymentType] || 0;
  const tonPrice = tonPrices[paymentType] || 0;

  const handleSuccess = (tier: NetworkTier) => {
    setPurchasedTiers(prev => [...prev, tier]);
    onSelect(tier);
    setShowPaymentChoice(null);
    setError('');
    onPaymentSuccess?.();
    onClose();
  };

  const handleStarsPay = async () => {
    if (!showPaymentChoice) return;
    setIsVerifying(true);
    setError('');

    try {
      const { invoice_url } = await createInvoice(paymentType);
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openInvoice) {
        tg.openInvoice(invoice_url, async (status: string) => {
          if (status === 'paid') {
            try {
              await verifyPayment(paymentType);
              handleSuccess(showPaymentChoice);
            } catch {
              setError('Payment verification failed');
            }
          } else if (status === 'failed') {
            setError('Payment was declined');
          }
          setIsVerifying(false);
        });
      } else {
        setError('Telegram Stars available only in Telegram app');
        setIsVerifying(false);
      }
    } catch (err: any) {
      setError(err?.data?.detail || 'Failed to create invoice');
      setIsVerifying(false);
    }
  };

  const handleTonPay = async () => {
    if (!showPaymentChoice) return;
    if (!isWalletConnected) {
      connectWallet();
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const result = await payWithTon(paymentType, telegramId);
      if (result) {
        handleSuccess(showPaymentChoice);
      } else {
        setError('TON payment failed or cancelled');
      }
    } catch (err: any) {
      setError(err?.data?.detail || err?.message || 'TON payment failed');
    }
    setIsVerifying(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-xl transition-opacity" onClick={() => !isVerifying && !isProcessing && onClose()} />
      
      <div className="relative w-full max-w-sm bg-[#0A0A0A] rounded-t-[44px] sm:rounded-[44px] border border-[#222] p-8 shadow-[0_0_80px_rgba(0,0,0,0.8)] transform transition-transform animate-slide-up overflow-hidden min-h-[520px]">
        <div className="absolute inset-0 bg-noise opacity-5 pointer-events-none"></div>
        <div className="w-12 h-1 bg-[#222] rounded-full mx-auto mb-8 sm:hidden opacity-40" />

        {/* Main List View */}
        <div className={`transition-all duration-300 ${showPaymentChoice ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
            <div className="flex justify-between items-center mb-8">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                        <Network size={14} className="text-primary" />
                        <span className="text-[10px] font-mono text-primary font-black uppercase tracking-widest">Protocol_Selector</span>
                    </div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Uplink Config</h2>
                </div>
                <button onClick={onClose} className="p-2.5 bg-[#111] border border-[#222] rounded-full text-white/40 active:scale-90 transition-all">
                    <X size={18} />
                </button>
            </div>

            <div className="flex flex-col gap-3">
                {tiers.map((tier) => {
                    const isActive = currentTier === tier.id;
                    const isPurchased = purchasedTiers?.includes(tier.id);
                    const isLockedByBalance = balance < tier.minBalance;
                    const Icon = tier.icon;
                    const tierPayType = TIER_PAYMENT_MAP[tier.id] || '';
                    const tierStars = starsPrices[tierPayType] || 0;

                    return (
                        <button
                            key={tier.id}
                            disabled={isLockedByBalance && !isPurchased}
                            onClick={() => {
                                if (isPurchased) {
                                    onSelect(tier.id);
                                    onClose();
                                } else if (!isLockedByBalance) {
                                    setError('');
                                    setShowPaymentChoice(tier.id);
                                }
                            }}
                            className={`
                                relative w-full p-4 rounded-3xl border flex items-center justify-between transition-all duration-300
                                ${isActive 
                                    ? 'bg-primary border-primary text-black shadow-glow-orange' 
                                    : isLockedByBalance && !isPurchased
                                        ? 'bg-[#0D0D0D] border-[#1A1A1A] opacity-40 cursor-not-allowed'
                                        : 'bg-[#111] border-[#222] hover:border-primary/40 text-white'}
                            `}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`
                                    w-11 h-11 rounded-2xl flex items-center justify-center border transition-all
                                    ${isActive ? 'bg-black text-white border-black' : 'bg-[#080808] border-[#222] ' + tier.color}
                                `}>
                                    <Icon size={20} />
                                </div>
                                <div className="flex flex-col items-start text-left">
                                    <span className="font-black font-sans uppercase text-sm tracking-tight">{tier.label}</span>
                                    <span className={`text-[10px] font-mono font-bold ${isActive ? 'text-black/60' : 'text-[#444]'}`}>
                                        {tier.speed}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-end">
                                {isActive ? (
                                    <div className="bg-black/10 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase flex items-center gap-1">
                                        Linked <Check size={12} strokeWidth={3} />
                                    </div>
                                ) : isPurchased ? (
                                    <div className="bg-[#222] px-3 py-1.5 rounded-xl text-[9px] font-black uppercase text-[#666]">Select</div>
                                ) : isLockedByBalance ? (
                                    <div className="flex flex-col items-end text-[#333]">
                                        <Lock size={16} className="mb-1" />
                                        <span className="text-[8px] font-mono font-black uppercase tracking-tighter leading-none">{tier.req}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 text-primary bg-primary/10 px-2.5 py-1.5 rounded-xl border border-primary/20">
                                        <ShoppingCart size={12} />
                                        <span className="text-[10px] font-black font-mono">{tierStars || '—'}</span>
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>

        {/* Payment Choice Panel */}
        {showPaymentChoice && (
            <div className="absolute inset-0 bg-[#0A0A0A] z-[210] flex flex-col p-8 animate-scale-up">
                <div className="absolute inset-0 bg-noise opacity-5 pointer-events-none"></div>
                
                <div className="flex justify-between items-start mb-8">
                    <div className="flex flex-col">
                        <span className="text-[#666] font-mono text-[10px] uppercase tracking-widest mb-1">Authorization</span>
                        <h2 className="text-2xl font-black text-white uppercase leading-none italic tracking-tighter">
                            {selectedTierData?.label.replace(' ', '_')}
                        </h2>
                    </div>
                    {!isVerifying && !isProcessing && (
                        <button onClick={() => setShowPaymentChoice(null)} className="w-10 h-10 rounded-xl bg-[#111] border border-[#222] flex items-center justify-center text-white/20 active:scale-90">
                            <X size={18} />
                        </button>
                    )}
                </div>

                {/* Central Protocol Card */}
                <div className="bg-primary/5 border border-primary/20 rounded-[32px] p-6 mb-8 flex gap-4 items-center group overflow-hidden relative">
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-black shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                        {selectedTierData && <selectedTierData.icon size={28} fill="currentColor" />}
                    </div>
                    <div className="flex flex-col relative z-10">
                        <span className="text-white font-black text-base uppercase leading-tight italic">
                            {selectedTierData?.label.toUpperCase()} UPLINK
                        </span>
                        <span className="text-primary text-[10px] font-mono font-black mt-1 tracking-widest uppercase">
                            {selectedTierData?.speed}
                        </span>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <button 
                        onClick={handleTonPay}
                        disabled={isVerifying || isProcessing}
                        className="w-full h-16 bg-white rounded-[24px] flex items-center justify-between px-6 active:scale-95 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <Wallet size={18} className="text-black" />
                            <span className="text-black font-black uppercase text-sm italic tracking-tighter">
                                {isWalletConnected ? 'TON_NETWORK' : 'CONNECT_WALLET'}
                            </span>
                        </div>
                        <span className="bg-black text-white px-3 py-1.5 rounded-xl text-[10px] font-mono font-black">{tonPrice} TON</span>
                    </button>
                    <button 
                        onClick={handleStarsPay}
                        disabled={isVerifying || isProcessing}
                        className="w-full h-16 bg-[#111] border border-white/5 rounded-[24px] flex items-center justify-between px-6 active:scale-95 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <Star size={18} className="text-primary" fill="currentColor" />
                            <span className="text-white font-black uppercase text-sm italic tracking-tighter">STARS_GATEWAY</span>
                        </div>
                        <span className="border border-primary/20 text-primary px-3 py-1.5 rounded-xl text-[10px] font-mono font-black">{starsPrice} STARS</span>
                    </button>
                </div>
                
                {(isVerifying || isProcessing) && (
                    <div className="mt-10 flex flex-col items-center gap-4 animate-scale-up">
                        <RefreshCw size={24} className="text-primary animate-spin" />
                        <span className="text-[10px] font-mono text-white/20 uppercase font-black tracking-[0.3em] text-center">
                            {isProcessing ? 'VERIFYING ON-CHAIN...' : 'CONFIRMING TRANSACTION...'}
                        </span>
                    </div>
                )}

                {error && (
                    <div className="mt-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                        <span className="text-[10px] font-mono text-red-400 uppercase font-black">{error}</span>
                    </div>
                )}

                {!isVerifying && !isProcessing && !error && (
                    <div className="mt-auto flex items-center justify-center gap-2 text-[9px] text-[#222] font-mono uppercase font-black tracking-widest">
                        <Triangle size={10} fill="#222" className="animate-pulse" />
                        <span>Secure Terminal Transaction</span>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};
