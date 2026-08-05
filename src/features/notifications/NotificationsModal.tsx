import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { supabase } from '../../services/supabase';
import { Bell, X, CheckCheck, Inbox } from 'lucide-react';

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationsModal({ isOpen, onClose }: NotificationsModalProps) {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !user) return;

    async function loadNotifications() {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user?.id) // Adicionado ? aqui
          .order('created_at', { ascending: false });

        if (error) throw error;
        setNotifications(data || []);
      } catch (error) {
        console.error("Erro ao carregar notificações:", error);
      } finally {
        setLoading(false);
      }
    }

    loadNotifications();

    const channel = supabase
      .channel('public:notifications_modal')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`, // Adicionado ? aqui
        },
        (payload) => {
          const newNotif = payload.new as NotificationItem;
          setNotifications(prev => [newNotif, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, user]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error("Erro ao atualizar notificação", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error("Erro ao marcar todas como lidas", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-card shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Cabeçalho */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2 text-carrin-dark font-bold">
            <Bell size={20} className="text-carrin-primary" />
            <span>Notificações da Casa</span>
          </div>
          <div className="flex items-center gap-2">
            {notifications.some(n => !n.is_read) && (
              <button 
                onClick={handleMarkAllAsRead}
                title="Marcar todas como lidas"
                className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1"
              >
                <CheckCheck size={16} /> Ler todas
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-carrin-dark p-1">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Lista de Notificações */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {loading ? (
            <p className="text-center text-gray-400 py-8 text-sm">Carregando notificações...</p>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
                <Inbox size={24} />
              </div>
              <p className="text-sm font-medium text-gray-600">Nenhuma notificação por enquanto</p>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                Quando alguém da casa adicionar ou comprar itens, os avisos aparecerão aqui.
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <div 
                key={item.id} 
                onClick={() => !item.is_read && handleMarkAsRead(item.id)}
                className={`p-3 rounded-small border transition-all cursor-pointer ${
                  item.is_read 
                    ? 'bg-white border-gray-100 text-gray-600' 
                    : 'bg-emerald-50/50 border-emerald-100 text-carrin-dark font-medium shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-bold text-carrin-dark">{item.title}</span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-gray-600">{item.message}</p>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}