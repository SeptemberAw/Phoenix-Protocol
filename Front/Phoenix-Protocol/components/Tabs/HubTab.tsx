
import React, { useState, useEffect } from 'react';
import { Copy, Users, Share2, ChevronRight, Activity, Zap, ShieldCheck, Check } from 'lucide-react';
import { Friend } from '../../types';
import { fetchReferrals, ApiReferral } from '../../api';

interface HubTabProps {
  onOpenFriend: (friend: Friend) => void;
  botUsername?: string;
}

export const HubTab: React.FC<HubTabProps> = ({ onOpenFriend, botUsername = 'purexprotocol_bot' }) => {
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [totalEarned, setTotalEarned] = useState('0');

  useEffect(() => {
    fetchReferrals().then(res => {
      if (res) {
        setReferralCode(res.referral_code);
        setFriendCount(res.count);
        setFriends(res.referrals.map((r, i) => ({
          id: String(r.telegram_id),
          username: r.telegram_username || `Operator_${r.telegram_id}`,
          joinedDate: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          totalBalance: parseFloat(r.balance),
          earnedForYou: Math.floor(parseFloat(r.balance) * 0.1),
        })));
      }
    }).catch((err) => {
      console.error('Failed to load referrals:', err);
    });
  }, []);

  const referralLink = `https://t.me/${botUsername}?start=r_${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join Purex Protocol',
        text: 'Join my neural mining network and earn PUREX together!',
        url: referralLink,
      }).catch(() => handleCopy());
    } else {
      handleCopy();
    }
  };

  return (
    <div className="flex flex-col w-full pt-2 gap-4 pb-24">
      
      {/* Invite Section - Tactical Uplink */}
      <div className="bg-[#111] rounded-[32px] border border-[#222] p-6 relative overflow-hidden group shadow-hard">
         <div className="absolute inset-0 bg-noise opacity-10 pointer-events-none"></div>
         <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Users size={160} />
         </div>

         <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
               <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
               <span className="text-[10px] font-mono text-primary uppercase tracking-[0.2em] font-bold">Protocol_Expansion</span>
            </div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none mb-2">Network Hub</h2>
            <p className="text-[11px] font-mono text-[#555] uppercase leading-relaxed max-w-[80%]">
              Sync new nodes to the grid. Extract <span className="text-primary">10% energy royalty</span> from connected operators.
            </p>
            
            <div className="flex gap-3 mt-6">
              <button 
                onClick={handleInvite}
                className="flex-1 h-12 bg-primary text-black font-sans font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-white transition-all active:scale-95 rounded-2xl"
              >
                 <Share2 size={16} /> Invite Operators
              </button>
              <button 
                onClick={handleCopy}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-95 border ${
                  copied 
                  ? 'bg-green-500 border-green-400 text-black' 
                  : 'bg-[#0A0A0A] border-[#333] text-white hover:border-primary'
                }`}
              >
                 {copied ? <Check size={18} /> : <Copy size={16} />}
              </button>
            </div>
            {copied && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-green-500 text-black text-[8px] font-mono font-black px-2 py-0.5 rounded uppercase animate-bounce">
                Link_Copied_To_Buffer
              </div>
            )}
         </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#111] border border-[#222] p-4 rounded-[24px] flex flex-col gap-1 relative overflow-hidden">
          <span className="text-[9px] font-mono text-[#444] uppercase font-bold tracking-widest">Nodes_Verified</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-black text-white">{String(friendCount)}</span>
            <span className="text-[10px] font-mono text-green-500 font-bold uppercase">Linked</span>
          </div>
          <Users size={40} className="absolute -right-4 -bottom-4 text-white/5" />
        </div>

        <div className="bg-[#111] border border-[#222] p-4 rounded-[24px] flex flex-col gap-1 relative overflow-hidden">
          <span className="text-[9px] font-mono text-[#444] uppercase font-bold tracking-widest">Royalty_Pool</span>
          <div className="flex items-baseline gap-1">
             <span className="text-3xl font-mono font-black text-primary">{friends.reduce((s, f) => s + f.earnedForYou, 0).toLocaleString('en-US')}</span>
             <span className="text-[10px] font-mono text-[#444] font-bold">CH</span>
          </div>
          {/* Fix: Property 'zap' does not exist on type 'JSX.IntrinsicElements'. Using capitalized Zap component. */}
          <Zap size={40} className="absolute -right-4 -bottom-4 text-primary/5" />
        </div>
      </div>

      {/* Connected Nodes List */}
      <div className="flex flex-col gap-2 mt-2">
        <div className="flex items-center justify-between px-2 mb-1">
           <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-[#444]" />
              <h3 className="text-[10px] font-mono font-black text-[#444] uppercase tracking-widest">Operator_Logs</h3>
           </div>
        </div>
        
        {friends.length > 0 ? (
          <div className="flex flex-col gap-2">
            {friends.map((friend) => (
              <div 
                key={String(friend.id)}
                onClick={() => onOpenFriend(friend)}
                className="bg-[#0A0A0A] border border-[#222] p-4 rounded-2xl hover:border-primary/30 cursor-pointer group flex items-center justify-between transition-all active:scale-[0.98]"
              >
                  <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-black border border-[#333] rounded-xl flex items-center justify-center text-lg font-mono font-black text-[#444] group-hover:text-primary group-hover:border-primary/50 transition-all relative overflow-hidden">
                          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          {String(friend.username).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                          <span className="text-sm font-sans font-black text-white group-hover:text-primary transition-colors uppercase tracking-tight">{String(friend.username)}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                             <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                             <span className="text-[9px] font-mono text-[#555] font-bold uppercase">Reward: +{String(friend.earnedForYou)} CH</span>
                          </div>
                      </div>
                  </div>
                  <div className="bg-[#111] p-2 rounded-lg border border-[#222] group-hover:border-primary/30">
                    <ChevronRight size={14} className="text-[#444] group-hover:text-primary" />
                  </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#111] border border-dashed border-[#222] rounded-3xl p-12 flex flex-col items-center justify-center text-center">
             <Activity size={32} className="text-[#222] mb-3" />
             <p className="text-[10px] font-mono text-[#444] uppercase font-bold">No external nodes detected</p>
          </div>
        )}
      </div>
    </div>
  );
};
