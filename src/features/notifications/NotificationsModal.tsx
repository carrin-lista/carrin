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

  // Estados Mobile
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchCurrentX, setTouchCurrentX] = useState(0);

  // Estados Desktop
  const [desktopMenuId, setDesktopMenuId] = useState<string | null>(null);
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

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

  // Fechar menu desktop clicando fora ou com Esc
  useEffect(() => {
    if (!desktopMenuId) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDesktopMenuId(null);
    };

    const handleClickOutside = () => {
      setDesktopMenuId(null);
    };

    document.addEventListener('keydown', handleEsc);
    // Mudamos de 'mousedown' e 'touchstart' para um único 'click' unificado
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 10);

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.removeEventListener('click', handleClickOutside);
      clearTimeout(timer);
    };
  }, [desktopMenuId]);

  // --- AÇÕES COM ATUALIZAÇÃO OTIMISTA ---

  const handleMarkAsRead = async (ids: string[]) => {
    const snapshot = [...notifications];
    setNotifications(prev => prev.map(n => (ids.includes(n.id) ? { ...n, is_read: true } : n)));
    setDesktopMenuId(null);

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', ids);
      
      if (error) throw error;
    } catch (error) {
      console.error("Erro ao marcar como lida:", error);
      setNotifications(snapshot); // Rollback
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    const snapshot = [...notifications];
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
    } catch (error) {
      console.error("Erro ao marcar todas como lidas:", error);
      setNotifications(snapshot); // Rollback
    }
  };

  const handleDeleteNotification = async (ids: string[]) => {
    const snapshot = [...notifications];
    setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
    setSwipedId(null);
    setDesktopMenuId(null);

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .in('id', ids);

      if (error) throw error;
    } catch (error) {
      console.error("Erro ao deletar notificação:", error);
      setNotifications(snapshot); // Rollback
      alert("Não foi possível excluir a notificação agora.");
    }
  };

  // --- AGRUPAMENTO INTELIGENTE (Mantido Intacto) ---
  const getGroupedNotifications = (): GroupedNotificationItem[] => {
    const grouped: GroupedNotificationItem[] = [];
    let i = 0;

    while (i < notifications.length) {
      const current = notifications[i];
      const lowerMessage = current.message.toLowerCase();
      const isAddition = lowerMessage.includes('adicionou');

      if (isAddition) {
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
  const hasUnread = notifications.some(n => !n.is_read);

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
            {hasUnread && (
              <button 
                onClick={handleMarkAllAsRead}
                title="Marcar todas como lidas"
                className="text-xs text-emerald-600 font-semibold hover:bg-emerald-50 px-2 py-1.5 rounded-md transition-colors flex items-center gap-1"
              >
                <CheckCheck size={16} /> Ler todas
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-carrin-dark hover:bg-gray-100 p-1 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Lista de Notificações */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 overflow-x-hidden relative">
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
              const isMenuOpen = desktopMenuId === item.id;

              return (
                <div key={item.id} className="relative overflow-visible rounded-small">
                  
                  {/* Botão de Excluir ao fundo (Mobile Swipe) */}
                  <div className="absolute inset-y-0 right-0 w-20 bg-red-600 text-white flex items-center justify-center rounded-small">
                    <button 
                      onClick={() => handleDeleteNotification(item.originalIds)}
                      className="w-full h-full flex items-center justify-center hover:opacity-90"
                      title="Excluir notificação"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {/* Card Principal */}
                  <div 
                    onTouchStart={(e) => {
                      if (isDesktop || isMenuOpen) return;
                      setTouchStartX(e.touches[0].clientX);
                      setTouchCurrentX(e.touches[0].clientX);
                    }}
                    onTouchMove={(e) => {
                      if (isDesktop || isMenuOpen) return;
                      setTouchCurrentX(e.touches[0].clientX);
                    }}
                    onTouchEnd={() => {
                      if (isDesktop || isMenuOpen) return;
                      const diff = touchStartX - touchCurrentX;
                      if (diff > 50) setSwipedId(item.id);
                      else if (diff < -50) setSwipedId(null);
                    }}
                    onClick={(e) => {
                      if (isSwiped) {
                        setSwipedId(null);
                        return;
                      }
                      
                      if (isDesktop) {
                        e.stopPropagation();
                        setDesktopMenuId(isMenuOpen ? null : item.id);
                        return;
                      }
                      
                      // No mobile, clique fora do swipe marca como lida
                      if (!item.is_read) handleMarkAsRead(item.originalIds);
                    }}
                    style={{
                      transform: isSwiped ? 'translateX(-80px)' : 'translateX(0px)',
                      transition: 'transform 0.2s ease-in-out'
                    }}
                    className={`p-3 rounded-small border transition-all cursor-pointer relative bg-white select-none ${
                      item.is_read 
                        ? 'border-gray-100 text-gray-500 bg-white' 
                        : 'border-emerald-100 text-carrin-dark bg-emerald-50/30'
                    } ${isDesktop ? 'hover:border-emerald-200' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1 pr-6">
                      <div className="flex items-center gap-1.5">
                        {!item.is_read && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0 shadow-sm" />}
                        <span className={`text-xs ${item.is_read ? 'font-semibold' : 'font-extrabold'}`}>{item.title}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className={`text-xs ${item.is_read ? 'text-gray-500' : 'text-gray-700 font-medium'}`}>{item.message}</p>
                    
                    {/* Menu Horizontal Desktop */}
                    {isMenuOpen && (
                      <div 
                        className="absolute right-2 top-2 flex items-center gap-1 bg-white border border-gray-200 shadow-md p-1 rounded-md z-10 animate-in fade-in zoom-in-95 duration-150"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!item.is_read && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsRead(item.originalIds);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded transition-colors"
                          >
                            <CheckCheck size={14} /> Lida
                          </button>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNotification(item.originalIds);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
                        >
                          <Trash2 size={14} /> Excluir
                        </button>
                      </div>
                    )}

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