import { useState, useCallback, useEffect } from 'react';
import { fetchPaymentPrices, PaymentResult } from '../api';

// TonConnect temporarily disabled — stub hook preserves interface for all consumers

interface TonPaymentHook {
  isWalletConnected: boolean;
  walletAddress: string | null;
  connectWallet: () => void;
  doDisconnectWallet: () => Promise<void>;
  payWithTon: (paymentType: string, telegramId: number) => Promise<PaymentResult | null>;
  isProcessing: boolean;
  error: string | null;
  tonPrices: Record<string, number>;
  starsPrices: Record<string, number>;
  treasuryWallet: string;
}

export function useTonPayment(): TonPaymentHook {
  const [tonPrices, setTonPrices] = useState<Record<string, number>>({});
  const [starsPrices, setStarsPrices] = useState<Record<string, number>>({});
  const [treasuryWallet, setTreasuryWallet] = useState('');

  useEffect(() => {
    fetchPaymentPrices()
      .then((data) => {
        setTonPrices(data.ton || {});
        setStarsPrices(data.stars || {});
        setTreasuryWallet(data.treasury_wallet || '');
      })
      .catch(() => {});
  }, []);

  const connectWallet = useCallback(() => {
    console.log('[TON] Wallet connect temporarily disabled');
  }, []);

  const doDisconnectWallet = useCallback(async () => {
    console.log('[TON] Wallet disconnect temporarily disabled');
  }, []);

  const payWithTon = useCallback(async (_paymentType: string, _telegramId: number): Promise<PaymentResult | null> => {
    console.log('[TON] TON payments temporarily disabled');
    return null;
  }, []);

  return {
    isWalletConnected: false,
    walletAddress: null,
    connectWallet,
    doDisconnectWallet,
    payWithTon,
    isProcessing: false,
    error: null,
    tonPrices,
    starsPrices,
    treasuryWallet,
  };
}
