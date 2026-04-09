
import React, { useState } from 'react';
import { X, ShieldAlert, Zap, Star, CheckCircle2, Binary, RefreshCw } from 'lucide-react';
import { createInvoice, verifyPayment } from '../../api';

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');

  const handlePay = async () => {
    setIsVerifying(true);
    setError('');

    try {
      const { invoice_url } = await createInvoice('verification');

      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openInvoice) {
        tg.openInvoice(invoice_url, async (status: string) => {
          if (status === 'paid') {
            try {
              await verifyPayment('verification');
              onSuccess();
            } catch {
              setError('Verification failed');
            }
          } else if (status === 'failed') {
            setError('Payment was declined');
          }
          setIsVerifying(false);
        });
      } else {
        // Fallback for non-TG environment: call onSuccess directly (dev mode)
        await onSuccess();
        setIsVerifying(false);
      }
    } catch (err: any) {
      setError(err.data?.detail || 'Failed to create invoice');
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => !isVerifying && onClose()} />
      
      <div className="relative w-full max-w-sm bg-[#080808] border-t sm:border border-white/10 rounded-t-[44px] sm:rounded-[44px] p-8 flex flex-col shadow-2xl animate-slide-up sm:animate-scale-up">
        <div className="absolute inset-0 bg-noise opacity-[0.03] pointer-events-none"></div>
        
        <div className="flex justify-between items-start mb-8">
            <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert size={14} className="text-primary animate-pulse" />
                    <span className="text-[9px] font-mono font-black text-primary uppercase tracking-[0.3em]">Anti_Bot_Protocol</span>
                </div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none italic">Identity Sync</h2>
            </div>
            {!isVerifying && (
                <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/20">
                    <X size={20} />
                </button>
            )}
        </div>

        <div className="mb-8 p-6 bg-primary/5 border border-primary/20 rounded-[32px]">
            <p className="text-xs font-mono text-[#888] uppercase leading-relaxed text-center italic">
                Secure node verification via blockchain consensus required.
            </p>
        </div>

        <div className="flex flex-col gap-3">
            <button 
                onClick={handlePay}
                disabled={isVerifying}
                className="w-full h-16 bg-white rounded-[24px] flex items-center justify-between px-6 transition-all active:scale-[0.98] group relative overflow-hidden"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white">
                        <Zap size={20} fill="currentColor" />
                    </div>
                    <span className="text-black font-black uppercase text-sm italic tracking-tighter">TON_NETWORK</span>
                </div>
                <span className="text-[10px] font-mono font-black text-white bg-black px-3 py-1.5 rounded-lg">0.2 TON</span>
            </button>

            <button 
                onClick={handlePay}
                disabled={isVerifying}
                className="w-full h-16 bg-[#111] border border-white/5 rounded-[24px] flex items-center justify-between px-6 transition-all active:scale-[0.98] group"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                        <Star size={20} fill="currentColor" />
                    </div>
                    <span className="text-white font-black uppercase text-sm italic tracking-tighter">STARS_GATEWAY</span>
                </div>
                <span className="text-[10px] font-mono font-black text-primary/60 border border-primary/20 px-3 py-1.5 rounded-lg">150 STARS</span>
            </button>
        </div>

        {isVerifying && (
            <div className="mt-10 flex flex-col items-center gap-4 animate-scale-up">
                <RefreshCw size={24} className="text-primary animate-spin" />
                <span className="text-[10px] font-mono text-white/20 uppercase font-black tracking-[0.3em] text-center">
                    CONFIRMING TRANSACTION ON-CHAIN...
                </span>
            </div>
        )}

        {!isVerifying && (
            <div className="mt-10 flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5">
                    <Binary size={10} className="text-[#222]" />
                    <span className="text-[8px] font-mono text-[#222] uppercase font-black tracking-widest">Protocol 3.1.2-Secure</span>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
