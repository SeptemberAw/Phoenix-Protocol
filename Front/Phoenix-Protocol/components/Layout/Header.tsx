
import React from 'react';
import { Settings, Bell, Zap, ShoppingCart } from 'lucide-react';

interface HeaderProps {
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenNotifications: () => void;
  onOpenShop: () => void;
  username: string;
  hasUnread: boolean;
  isVerified?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ 
  onOpenProfile, 
  onOpenSettings, 
  onOpenNotifications, 
  onOpenShop,
  username, 
  hasUnread,
  isVerified = false
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 h-[64px] z-40 px-5 flex items-center justify-between bg-background/80 backdrop-blur-md border-b border-white/5">
      
      {/* Profile ID */}
      <div className="flex flex-col cursor-pointer" onClick={onOpenProfile}>
         <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] text-[#555] font-mono font-bold uppercase tracking-widest">Operator ID</span>
            {isVerified && (
              <div className="flex items-center gap-0.5 bg-primary/10 px-1 rounded animate-pulse">
                  <Zap size={8} className="text-primary fill-primary" />
                  <span className="text-[7px] font-mono font-black text-primary uppercase tracking-tighter">Active_Link</span>
              </div>
            )}
         </div>
         <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_#FF3B00]"></div>
            <span className="text-lg font-bold text-white font-sans uppercase tracking-tight tabular-nums">{String(username)}</span>
         </div>
      </div>

      {/* Action Icons */}
      <div className="flex items-center gap-2">
         <button 
            type="button"
            onClick={onOpenShop}
            className="w-10 h-10 rounded-full bg-[#161616] border border-[#222] flex items-center justify-center text-white active:scale-90 transition-all"
         >
            <ShoppingCart size={18} />
         </button>
         <button 
            type="button"
            onClick={onOpenNotifications}
            className="w-10 h-10 rounded-full bg-[#161616] border border-[#222] flex items-center justify-center text-white active:scale-90 transition-all relative"
         >
            <Bell size={18} />
            {hasUnread && <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full shadow-[0_0_5px_#FF3B00]"></div>}
         </button>
         <button 
            type="button"
            onClick={onOpenSettings}
            className="w-10 h-10 rounded-full bg-[#161616] border border-[#222] flex items-center justify-center text-white active:scale-90 transition-all"
         >
            <Settings size={18} />
         </button>
      </div>
    </header>
  );
};
