
import React, { useState, useMemo, useEffect } from 'react';
import { Check, ChevronRight, Send, Twitter, Wallet, Users, Terminal, Cpu, Zap, Activity, Handshake } from 'lucide-react';
import { TaskDetailModal } from '../UI/TaskDetailModal';
import { Task } from '../../types';
import { claimQuest } from '../../api';

interface EarnTabProps {
  initialQuests?: Task[];
}

export const EarnTab: React.FC<EarnTabProps> = ({ initialQuests }) => {
  const [tasks, setTasks] = useState<Task[]>(initialQuests || []);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    if (initialQuests && initialQuests.length > 0) {
      setTasks(initialQuests);
    }
  }, [initialQuests]);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'twitter': return <Twitter size={18} />;
      case 'send': return <Send size={18} />;
      case 'wallet': return <Wallet size={18} />;
      case 'users': return <Users size={18} />;
      case 'partner': return <Handshake size={18} />;
      default: return <Terminal size={18} />;
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const res = await claimQuest(parseInt(taskId));
      if (res) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isCompleted: true } : t));
      }
    } catch {
      // Quest not yet completable or already claimed
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isCompleted: true } : t));
    }
  };

  // Sort: Incomplete first, then completed. 
  // Secondary sort: High reward first.
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.isCompleted === b.isCompleted) {
        return b.reward - a.reward;
      }
      return a.isCompleted ? 1 : -1;
    });
  }, [tasks]);

  return (
    <div className="flex flex-col w-full pt-2 gap-4 pb-24">
      
      {/* Header Directive Block */}
      <div className="bg-primary rounded-[32px] p-6 relative overflow-hidden shadow-glow-orange group">
         <div className="absolute inset-0 bg-noise opacity-20 pointer-events-none"></div>
         <div className="absolute right-0 top-0 opacity-10 -translate-y-4">
            <Terminal size={140} className="text-black" />
         </div>
         <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
                <Cpu size={14} className="text-black/60" />
                <span className="text-[10px] font-mono font-black text-black/60 uppercase tracking-[0.2em]">Priority_Tasks</span>
            </div>
            <h2 className="text-3xl font-black text-black uppercase tracking-tighter leading-none mb-2">Active Directives</h2>
            <p className="text-[11px] font-mono text-black/60 font-bold uppercase leading-tight max-w-[85%]">
               Execute the following protocols to increase neural network density and earn <span className="text-black">PUREX rewards</span>.
            </p>
         </div>
      </div>

      {/* Directives List */}
      <div className="flex flex-col gap-3">
        {sortedTasks.map((task) => {
          const hasProgress = task.targetProgress !== undefined;
          const progressPercent = hasProgress ? Math.min(100, Math.floor(((task.currentProgress || 0) / (task.targetProgress || 1)) * 100)) : 0;

          return (
            <div 
              key={String(task.id)}
              onClick={() => setSelectedTask(task)}
              className={`
                relative flex flex-col p-4 rounded-3xl border transition-all cursor-pointer group overflow-hidden
                ${task.isCompleted 
                  ? 'bg-[#0D0D0D] border-[#222] opacity-60' 
                  : 'bg-[#111] border-[#222] hover:border-primary/50 active:scale-[0.98] shadow-hard'}
              `}
            >
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                  {/* Task Icon */}
                  <div className={`
                    w-12 h-12 rounded-2xl flex items-center justify-center transition-all border shrink-0
                    ${task.isCompleted 
                        ? 'bg-black border-[#222] text-[#333]' 
                        : 'bg-[#0A0A0A] border-[#333] text-white group-hover:border-primary group-hover:text-primary shadow-[inset_0_0_10px_rgba(255,59,0,0.1)]'}
                  `}>
                    {task.isCompleted ? <Check size={20} strokeWidth={3} /> : getIcon(task.icon)}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className={`text-[13px] font-black uppercase tracking-tight truncate ${task.isCompleted ? 'text-[#444] line-through' : 'text-white group-hover:text-primary transition-colors'}`}>
                      {String(task.title)}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                        <div className={`flex items-center gap-1 text-[10px] font-mono font-black px-2 py-0.5 rounded uppercase ${task.isCompleted ? 'bg-[#222] text-[#555]' : 'bg-primary/10 text-primary'}`}>
                          <Zap size={10} fill="currentColor" />
                          +{new Intl.NumberFormat('en-US').format(Number(task.reward))}
                        </div>
                        {task.isCompleted ? (
                          <span className="text-[9px] font-mono text-green-500 font-bold uppercase tracking-widest">Verified</span>
                        ) : hasProgress ? (
                          <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#555] font-black uppercase">
                             <Activity size={10} /> {task.currentProgress}/{task.targetProgress}
                          </div>
                        ) : null}
                    </div>
                  </div>
                </div>

                {!task.isCompleted && (
                    <div className="bg-[#1A1A1A] p-2 rounded-xl border border-[#333] group-hover:border-primary/50 transition-colors ml-2 shrink-0">
                      <ChevronRight size={16} className="text-[#444] group-hover:text-primary" />
                    </div>
                )}
              </div>

              {/* Progressive Load Bar */}
              {hasProgress && !task.isCompleted && (
                 <div className="mt-4 w-full h-1 bg-black rounded-full overflow-hidden border border-white/5">
                    <div 
                      className="h-full bg-primary/40 group-hover:bg-primary transition-all duration-500" 
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                 </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Detail Modal */}
      <TaskDetailModal 
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        onComplete={handleCompleteTask}
      />

      {/* Footer Info */}
      <div className="mt-2 p-6 border border-dashed border-[#222] rounded-[32px] flex flex-col items-center gap-2">
          <Terminal size={20} className="text-[#333]" />
          <p className="text-[9px] font-mono text-[#444] uppercase font-bold text-center leading-tight">
            Task synchronization occurs via blockchain oracle.<br/>
            Social verifications may take up to 60 seconds.
          </p>
      </div>
    </div>
  );
};
