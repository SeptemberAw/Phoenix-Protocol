
import React from 'react';
import { LayoutGrid, Trophy, Network, Zap, Swords } from 'lucide-react';
import { Tab } from '../../types';

interface NavigationProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const navItems = [
    { id: Tab.MINE, icon: LayoutGrid, label: 'DASH' },
    { id: Tab.FIGHT, icon: Swords, label: 'FIGHT' },
    { id: Tab.TOP, icon: Trophy, label: 'RANK' },
    { id: Tab.HUB, icon: Network, label: 'NET' },
    { id: Tab.EARN, icon: Zap, label: 'OPS' },
  ];

  return (
    <div className="fixed bottom-6 left-4 right-4 z-50">
      <nav className="mx-auto max-w-[420px] h-18 bg-[#0C0C0C]/90 backdrop-blur-2xl rounded-[24px] border border-white/5 shadow-[0_20px_40px_rgba(0,0,0,0.6)] flex justify-between items-center px-3 relative overflow-hidden">
        
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
        <div className="absolute inset-0 bg-noise opacity-[0.03] pointer-events-none"></div>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className="relative flex-1 flex flex-col items-center justify-center gap-1.5 h-full z-10 transition-all duration-200"
            >
              <div className={`
                absolute top-0 w-8 h-[2px] rounded-full transition-all duration-300
                ${isActive ? 'bg-primary shadow-[0_0_10px_#FF3B00] opacity-100' : 'opacity-0'}
              `} />

              <div className={`
                relative p-2 rounded-xl transition-all duration-300 ease-out flex items-center justify-center
                ${isActive ? 'text-primary scale-110' : 'text-[#555]'}
              `}>
                {isActive && (
                  <div className="absolute inset-0 bg-primary/5 blur-md rounded-full animate-pulse"></div>
                )}
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className="relative z-10" />
              </div>
              
              <span className={`
                text-[7px] font-mono font-black tracking-[0.2em] transition-colors duration-300 uppercase
                ${isActive ? 'text-white opacity-100' : 'text-[#444] opacity-70'}
              `}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
