
import React, { useState } from 'react';
import { X, Zap, ChevronRight, ExternalLink, ShieldCheck, RefreshCw, Terminal, Cpu, Check, Copy, Share2, Users } from 'lucide-react';
import { Task } from '../../types';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onComplete: (taskId: string) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ isOpen, onClose, task, onComplete }) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const referralLink = "https://t.me/purexprotocol_bot?start=r_32193";

  if (!isOpen || !task) return null;

  const handleAction = () => {
    // Logic based on Task Type
    if (task.type === 'referral') {
       if (navigator.share) {
         navigator.share({
           title: 'Join Purex Protocol',
           text: 'Join my neural network and earn PUREX!',
           url: referralLink,
         }).catch(() => {
           navigator.clipboard.writeText(referralLink);
           setIsCopied(true);
           setTimeout(() => setIsCopied(false), 2000);
         });
       } else {
         navigator.clipboard.writeText(referralLink);
         setIsCopied(true);
         setTimeout(() => setIsCopied(false), 2000);
       }
    } else if (task.actionUrl) {
      // Social / Website Link
      window.open(task.actionUrl, '_blank');
    }
  };

  const handleVerify = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      
      // Verification Logic
      if (task.type === 'referral') {
        // For referrals, we strictly check progress
        if ((task.currentProgress || 0) >= (task.targetProgress || 1)) {
           onComplete(task.id);
           onClose();
        } else {
           // Provide feedback (visual shake or toast in real app)
           // Here we just don't close the modal
           console.log("Not enough invites");
        }
      } else {
        // Social/Wallet tasks - simulate server check success
        onComplete(task.id);
        onClose();
      }
    }, 2000);
  };

  const progress = task.targetProgress ? (task.currentProgress || 0) / task.targetProgress : 0;
  const isActionCompleted = task.type === 'referral' ? false : (task.isCompleted); 

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-sm bg-[#080808] border border-[#222] rounded-[32px] overflow-hidden shadow-glow-orange animate-scale-up">
        <div className="absolute inset-0 bg-noise opacity-10 pointer-events-none"></div>
        
        <div className="relative z-10 p-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-primary" />
                    <span className="text-[10px] font-mono text-primary uppercase tracking-widest font-black">
                        {task.type === 'referral' ? 'Expansion_Protocol' : 'Task_Protocol'}
                    </span>
                </div>
                <button onClick={onClose} className="p-2 bg-[#111] border border-[#222] rounded-full text-gray-500 hover:text-white transition-colors">
                    <X size={18} />
                </button>
            </div>

            <div className="flex flex-col items-center text-center mb-8">
                <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center text-primary mb-4 shadow-[inset_0_0_15px_rgba(255,59,0,0.1)]">
                   {task.type === 'referral' ? <Users size={32} /> : <Cpu size={32} />}
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2 leading-none">{task.title}</h2>
                <p className="text-xs font-mono text-[#666] uppercase leading-relaxed px-4">
                    {task.description}
                </p>
            </div>

            {task.targetProgress !== undefined && (
                <div className="bg-[#111] border border-[#222] rounded-2xl p-4 mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-mono text-[#444] font-bold uppercase tracking-widest">Network_Sync</span>
                        <span className="text-xs font-mono font-black text-primary">{task.currentProgress} / {task.targetProgress}</span>
                    </div>
                    <div className="w-full h-1.5 bg-black rounded-full overflow-hidden border border-white/5">
                        <div 
                            className="h-full bg-primary transition-all duration-1000" 
                            style={{ width: `${Math.min(100, progress * 100)}%` }}
                        ></div>
                    </div>
                    {task.type === 'referral' && (
                        <p className="text-[8px] font-mono text-[#444] mt-2 text-center uppercase">
                            Invites are synced every 30 seconds.
                        </p>
                    )}
                </div>
            )}

            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between p-4 bg-primary/10 border border-primary/20 rounded-2xl mb-2">
                    <span className="text-xs font-mono font-black text-primary uppercase">Reward Pool</span>
                    <div className="flex items-center gap-1.5 text-lg font-black text-primary">
                        <Zap size={16} fill="currentColor" />
                        {new Intl.NumberFormat('en-US').format(task.reward)} CH
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={handleAction}
                        disabled={task.isCompleted}
                        className={`
                            h-14 rounded-2xl font-sans font-black text-[11px] uppercase flex items-center justify-center gap-2 transition-all active:scale-95
                            ${task.isCompleted 
                                ? 'bg-[#111] text-[#333] border border-[#222]' 
                                : isCopied 
                                    ? 'bg-green-500 text-black' 
                                    : 'bg-white text-black hover:bg-gray-200'}
                        `}
                    >
                        {task.type === 'referral' 
                            ? (isCopied ? <Check size={14} /> : <Share2 size={14} />) 
                            : <ExternalLink size={14} />
                        }
                        {task.type === 'referral' 
                             ? (isCopied ? 'Copied' : 'Invite') 
                             : (task.buttonLabel || 'Execute')
                        }
                    </button>
                    
                    <button 
                        onClick={handleVerify}
                        disabled={task.isCompleted || isVerifying}
                        className={`
                            h-14 rounded-2xl font-sans font-black text-[11px] uppercase flex items-center justify-center gap-2 transition-all active:scale-95
                            ${isVerifying ? 'bg-primary/20 text-primary animate-pulse' : 
                              task.isCompleted ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 
                              'bg-primary text-black hover:bg-primary-dark shadow-glow-orange'}
                        `}
                    >
                        {isVerifying ? <RefreshCw size={14} className="animate-spin" /> : 
                         task.isCompleted ? <ShieldCheck size={14} /> : 'Check Status'}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
