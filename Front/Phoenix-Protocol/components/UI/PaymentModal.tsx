
import React, { useState } from 'react';
import { X, Zap, Battery, Triangle, CheckCircle2, Sparkles, Binary, RefreshCw, Star, Wallet } from 'lucide-react';
import { createInvoice, verifyPayment } from '../../api';
import { useTonPayment } from '../../hooks/useTonPayment';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'multitap' | 'energy' | 'autobot' | null;
  telegramId: number;
  maxEnergy?: number;
  onPaymentSuccess?: (type: string) => void;
}

// Map modal type to backend payment_type
const TYPE_MAP: Record<string, string> = {
  multitap: 'multitap',
  energy: 'energy_boost',
  autobot: 'autobot',
};

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, type, telegramId, maxEnergy = 6000, onPaymentSuccess }) => {
  const [isSuccess, setIsSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const { isWalletConnected, connectWallet, payWithTon, isProcessing, tonPrices, starsPrices } = useTonPayment();

  const handleStarsPay = async () => {
    if (!type) return;
    setIsVerifying(true);
    setError('');

    const paymentType = TYPE_MAP[type] || type;

    try {
      const { invoice_url } = await createInvoice(paymentType);

      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openInvoice) {
        tg.openInvoice(invoice_url, async (status: string) => {
          if (status === 'paid') {
            try {
              await verifyPayment(paymentType);
              setIsSuccess(true);
              onPaymentSuccess?.(paymentType);
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
      setError(err.data?.detail || 'Failed to create invoice');
      setIsVerifying(false);
    }
  };

  const handleTonPay = async () => {
    if (!type) return;
    if (!isWalletConnected) {
      connectWallet();
      return;
    }

    setIsVerifying(true);
    setError('');

    const paymentType = TYPE_MAP[type] || type;

    try {
      const result = await payWithTon(paymentType, telegramId);
      if (result) {
        setIsSuccess(true);
        onPaymentSuccess?.(paymentType);
      } else {
        setError('TON payment failed or cancelled');
      }
    } catch (err: any) {
      setError(err?.data?.detail || err?.message || 'TON payment failed');
    }
    setIsVerifying(false);
  };

  const handleClose = () => {
    setIsSuccess(false);
    setIsVerifying(false);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl" onClick={handleClose} />
        <div className="relative w-full max-w-sm bg-[#0A0A0A] border border-primary/30 rounded-[40px] p-8 text-center animate-scale-up shadow-[0_0_100px_rgba(255,59,0,0.2)]">
            <div className="absolute inset-0 bg-noise opacity-10 pointer-events-none"></div>
            
            <div className="relative mb-6 flex justify-center">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
                <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center text-black relative z-10 shadow-[0_0_40px_rgba(255,59,0,0.5)]">
                    <CheckCircle2 size={48} strokeWidth={2.5} />
                </div>
            </div>

            <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2 italic">Protocol Linked</h2>
            <p className="text-sm font-mono text-[#666] uppercase mb-8 leading-tight tracking-wider">
                {type === 'multitap' ? 'Turbo boost synchronized' : 
                 type === 'energy' ? 'Energy banks fully saturated' : 
                 'Auto-processing unit online'}
            </p>

            <div className="bg-[#111] border border-[#222] rounded-2xl p-4 flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Binary size={18} />
                    </div>
                    <div className="text-left">
                        <span className="text-[10px] font-mono text-[#444] block uppercase">Network_ID</span>
                        <span className="text-xs font-mono font-bold text-white tracking-tighter">0xCC2...F9A1</span>
                    </div>
                </div>
                <Sparkles className="text-primary animate-pulse" size={18} />
            </div>

            <button 
                onClick={handleClose}
                className="w-full h-14 bg-white text-black font-sans font-black text-sm uppercase rounded-2xl active:scale-95 transition-all shadow-glow-white"
            >
                Confirm Sync
            </button>
        </div>
      </div>
    );
  }

  const paymentType = TYPE_MAP[type || ''] || type || '';
  const starsPrice = starsPrices[paymentType] || 0;
  const tonPrice = tonPrices[paymentType] || 0;

  const getDetails = () => {
    switch(type) {
        case 'multitap':
            return { title: 'Turbo_Uplink', desc: 'Double Hashing Rate', sub: 'x2.0 Boost (24H)', icon: <Zap size={24} fill="black" /> };
        case 'energy':
            return { title: 'Energy_Pack', desc: 'Full Power Restore', sub: `+${maxEnergy} Power Units`, icon: <Battery size={24} fill="black" /> };
        case 'autobot':
            return { title: 'Auto_Miner', desc: 'Auto-Processing Core', sub: 'Continuous Extraction (24H)', icon: <RefreshCw size={24} /> };
        default:
            return { title: '', desc: '', sub: '', icon: null };
    }
  };

  const details = getDetails();

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-lg transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-sm bg-[#0A0A0A] rounded-t-[44px] sm:rounded-[44px] border border-[#222] p-8 shadow-2xl transform transition-transform animate-slide-up sm:animate-scale-up">
        <div className="absolute inset-0 bg-noise opacity-5 pointer-events-none"></div>
        <div className="w-12 h-1 bg-[#222] rounded-full mx-auto mb-6 sm:hidden opacity-40" />

        <div className="flex justify-between items-start mb-8">
            <div className="flex flex-col">
                <span className="text-[#666] font-mono text-[10px] uppercase tracking-widest mb-1">Authorization</span>
                <h2 className="text-2xl font-black text-white uppercase leading-none italic tracking-tighter">
                    {details.title}
                </h2>
            </div>
            {!isVerifying && (
                <button onClick={onClose} className="w-10 h-10 rounded-xl bg-[#111] border border-[#222] flex items-center justify-center text-white/20">
                    <X size={18} />
                </button>
            )}
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 mb-8 flex gap-4 items-center group overflow-hidden relative">
             <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
             <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-black shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                 {details.icon}
             </div>
             <div className="flex flex-col relative z-10">
                 <span className="text-white font-black text-base uppercase leading-tight italic">
                    {details.desc}
                 </span>
                 <span className="text-primary text-[10px] font-mono font-black mt-1 tracking-widest uppercase">
                     {details.sub}
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
                    <div className="w-10 h-10 bg-black/10 rounded-xl flex items-center justify-center text-black">
                        <Wallet size={20} />
                    </div>
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
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                        <Star size={20} fill="currentColor" />
                    </div>
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
            <div className="mt-10 flex items-center justify-center gap-2 text-[9px] text-[#222] font-mono uppercase font-black tracking-widest">
                <Triangle size={10} fill="#222" className="animate-pulse" />
                <span>Secure Terminal Transaction</span>
            </div>
        )}
      </div>
    </div>
  );
}
