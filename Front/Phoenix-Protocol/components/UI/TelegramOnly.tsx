import React from 'react';
import { Send } from 'lucide-react';

interface TelegramOnlyProps {
  botUsername: string;
}

export const TelegramOnly: React.FC<TelegramOnlyProps> = ({ botUsername }) => {
  const telegramUrl = `https://t.me/${botUsername}`;

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#111] border border-[#222] rounded-2xl p-8 text-center">
        <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Send size={40} className="text-primary" />
        </div>
        
        <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-4">
          Purex Protocol
        </h1>
        
        <p className="text-[#888] text-sm mb-8 leading-relaxed">
          This application can only be accessed through Telegram Mini App.<br/>
          Please open it from Telegram to continue.
        </p>
        
        <a 
          href={telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded-xl transition-all active:scale-95"
        >
          <Send size={18} />
          Open in Telegram
        </a>
        
        <p className="text-[#555] text-xs mt-6 font-mono">
          Bot: @{botUsername}
        </p>
      </div>
    </div>
  );
};
