import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { NotificationsModal } from './NotificationsModal';
import { useAuthStore } from '../../stores/useAuthStore';
import { supabase } from '../../services/supabase';

export function NotificationBell() {
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    async function checkUnread() {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (!error && count !== null) {
        setUnreadCount(count);
      }
    }

    checkUnread();

    const channel = supabase
      .channel('bell-notifications')
      .on(
        'postgres_changes',
        // Escuta qualquer evento (Insert, Update, Delete) para sempre manter o badge preciso
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          checkUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="relative p-2 text-gray-400 hover:text-carrin-dark transition-colors bg-white rounded-full shadow-sm border border-gray-100 flex items-center justify-center"
        title="Notificações da Casa"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full ring-2 ring-white flex items-center justify-center animate-in zoom-in">
            {unreadCount}
          </span>
        )}
      </button>

      <NotificationsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}