import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { NotificationsModal } from './NotificationsModal';
import { useAuthStore } from '../../stores/useAuthStore';
import { supabase } from '../../services/supabase';

export function NotificationBell() {
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function checkUnread() {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (!error && count && count > 0) {
        setHasUnread(true);
      }
    }

    checkUnread();

    const channel = supabase
      .channel('bell-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => setHasUnread(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleOpen = async () => {
    setIsOpen(true);
    setHasUnread(false); 

    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      console.error('Erro ao marcar notificações como lidas:', error);
    }
  };

  return (
    <>
      <button 
        onClick={handleOpen}
        className="relative p-2 text-gray-400 hover:text-carrin-dark transition-colors bg-white rounded-full shadow-sm border border-gray-100 flex items-center justify-center"
        title="Notificações da Casa"
      >
        <Bell size={20} />
        {hasUnread && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />
        )}
      </button>

      <NotificationsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}