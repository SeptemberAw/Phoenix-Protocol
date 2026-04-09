
import React from 'react';
import { X, Mail, MailOpen } from 'lucide-react';
import { NotificationItem } from '../../types';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose, notifications }) => {
  if (!isOpen) return null;

  const hasNotifications = notifications.length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-sm bg-[#121212] border border-[#333] rounded-[24px] p-6 animate-scale-up min-h-[300px] flex flex-col">
        
        <div className="flex justify-between items-center mb-6 border-b border-[#222] pb-4">
            <h2 className="text-lg font-sans font-bold text-white uppercase flex items-center gap-2">
                <Mail size={18} /> System Mail
            </h2>
            <button onClick={onClose} className="p-2 bg-[#222] rounded-full hover:bg-[#333] transition-colors">
                <X size={16} className="text-white" />
            </button>
        </div>

        {hasNotifications ? (
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[400px]">
                {notifications.map(notif => (
                    <div key={notif.id} className="p-4 rounded-xl border bg-[#161616] border-[#222] relative">
                        <h3 className="text-sm font-bold mb-1 text-white">{notif.title}</h3>
                        <p className="text-xs text-[#666] leading-relaxed mb-2">{notif.message}</p>
                        <span className="text-[10px] text-[#444] font-mono uppercase">{notif.date}</span>
                    </div>
                ))}
            </div>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#333]">
                <MailOpen size={48} className="mb-4 opacity-50" />
                <span className="text-sm font-mono font-bold uppercase">Mailbox Empty</span>
            </div>
        )}

      </div>
    </div>
  );
};
