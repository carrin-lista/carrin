import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { supabase } from '../../services/supabase';
import { Bell, X, CheckCheck, Inbox, Trash2 } from 'lucide-react';

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface GroupedNotificationItem {
  id: string;
  originalIds: string[];
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

  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchCurrentX, setTouchCurrentX] = useState(0);

  useEffect(() => {
    if (!isOpen || !user) return;

    async function loadNotifications() {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user?.id)
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
          filter: `user_id=eq.${user?.id}`,
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

  const handleMarkAsRead = async (ids: string[]) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', ids);

      setNotifications(prev =>
        prev.map(n => (ids.includes(n.id) ? { ...n, is_read: true } : n))
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

  const handleDeleteNotification = async (ids: string[]) => {
    try {
      await supabase
        .from('notifications')
        .delete()
        .in('id', ids);

      setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
      setSwipedId(null);
    } catch (error) {
      console.error("Erro ao deletar notificação:", error);
    }
  };

  // AGRUPAMENTO INTELIGENTE CORRIGIDO
  const getGroupedNotifications = (): GroupedNotificationItem[] => {
    const grouped: GroupedNotificationItem[] = [];
    let i = 0;

    while (i < notifications.length) {
      const current = notifications[i];
      const lowerMessage = current.message.toLowerCase();
      const isAddition = lowerMessage.includes('adicionou');

      if (isAddition) {
        // Extrai o nome do usuário de dentro da mensagem (ex: "João adicionou Arroz" -> "João")
        const match = current.message.match(/^(.+?)\s+adicionou/i);
        const actorName = match ? match[1] : null;

        if (actorName) {
          const batchIds = [current.id];
          let j = i + 1;

          while (j < notifications.length) {
            const next = notifications[j];
            const nextLowerMessage = next.message.toLowerCase();
            const timeDiff = Math.abs(new Date(current.created_at).getTime() - new Date(next.created_at).getTime());
            const nextMatch = next.message.match(/^(.+?)\s+adicionou/i);
            const nextActor = nextMatch ? nextMatch[1] : null;
            const nextIsAddition = nextLowerMessage.includes('adicionou');

            // Agrupa se for do mesmo autor, também for adição e estiver num intervalo menor que 10 minutos
            if (nextActor === actorName && nextIsAddition && timeDiff < 10 * 60 * 1000) {
              batchIds.push(next.id);
              j++;
            } else {
              break;
            }
          }

          if (batchIds.length > 1) {
            grouped.push({
              id: current.id,
              originalIds: batchIds,
              title: current.title,
              message: `${actorName} adicionou ${batchIds.length} novos itens à lista.`,
              is_read: batchIds.every(id => {
                const item = notifications.find(n => n.id === id);
                return item?.is_read;
              }),
              created_at: current.created_at,
            });
            i = j;
            continue;
          }
        }
      }

      grouped.push({
        id: current.id,
        originalIds: [current.id],
        title: current.title,
        message: current.message,
        is_read: current.is_read,
        created_at: current.created_at,
      });
      i++;
    }

    return grouped;
  };

  const displayedNotifications = getGroupedNotifications();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-card shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Cabeçalho */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 shrink-0">
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

        {/* Lista de Notificações com Swipe to Delete */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 overflow-x-hidden">
          {loading ? (
            <p className="text-center text-gray-400 py-8 text-sm">Carregando notificações...</p>
          ) : displayedNotifications.length === 0 ? (
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
            displayedNotifications.map((item) => {
              const isSwiped = swipedId === item.id;

              return (
                <div key={item.id} className="relative overflow-hidden rounded-small">
                  
                  {/* Botão de Excluir ao fundo */}
                  <div className="absolute inset-y-0 right-0 w-20 bg-red-600 text-white flex items-center justify-center rounded-small">
                    <button 
                      onClick={() => handleDeleteNotification(item.originalIds)}
                      className="w-full h-full flex items-center justify-center hover:opacity-90"
                      title="Excluir notificação"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {/* Card Deslizante */}
                  <div 
                    onTouchStart={(e) => {
                      setTouchStartX(e.touches[0].clientX);
                      setTouchCurrentX(e.touches[0].clientX);
                    }}
                    onTouchMove={(e) => {
                      setTouchCurrentX(e.touches[0].clientX);
                    }}
                    onTouchEnd={() => {
                      const diff = touchStartX - touchCurrentX;
                      if (diff > 50) {
                        setSwipedId(item.id);
                      } else if (diff < -50) {
                        setSwipedId(null);
                      }
                    }}
                    style={{
                      transform: isSwiped ? 'translateX(-80px)' : 'translateX(0px)',
                      transition: 'transform 0.2s ease-in-out'
                    }}
                    onClick={() => {
                      if (isSwiped) {
                        setSwipedId(null);
                        return;
                      }
                      if (!item.is_read) {
                        handleMarkAsRead(item.originalIds);
                      }
                    }}
                    className={`p-3 rounded-small border transition-all cursor-pointer relative bg-white select-none ${
                      item.is_read 
                        ? 'border-gray-100 text-gray-600' 
                        : 'border-emerald-100 text-carrin-dark font-medium shadow-sm bg-emerald-50/50'
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

                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}