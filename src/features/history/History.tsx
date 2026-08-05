import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { historyService } from '../../services/historyService';
import { itemService } from '../../services/itemService';
import { homeService } from '../../services/homeService';
import { 
  Calendar, ShoppingBag, CheckCircle2, 
  X, Clock, User, TrendingUp, RotateCcw, ChevronRight, AlertCircle, Check, Wallet, Copy
} from 'lucide-react';

export function History() {
  const { user, homeId } = useAuthStore();
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [homeMembers, setHomeMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estados do Módulo Pix
  const [showPixModal, setShowPixModal] = useState(false);
  const [splitMembers, setSplitMembers] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!homeId) return;
      try {
        // Carrega o histórico e os moradores da casa simultaneamente
        const [historyData, membersData] = await Promise.all([
          historyService.getHistory(homeId),
          homeService.getHomeMembers(homeId)
        ]);
        setHistoryList(historyData);
        setHomeMembers(membersData);
      } catch (error) {
        console.error("Erro ao carregar dados do histórico:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [homeId]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleRestoreUnboughtItems = async (unboughtItems: any[]) => {
    if (!homeId || !user || unboughtItems.length === 0) return;
    
    setRestoring(true);
    try {
      await Promise.all(unboughtItems.map(item => 
        itemService.addItem({
          name: item.name,
          quantity: item.quantity,
          observation: item.observation,
          category_id: item.category_id || '🛒 Mantimentos',
          home_id: homeId,
          created_by: user.id
        } as any)
      ));
      
      showFeedback('success', `${unboughtItems.length} itens retornaram para a sua lista!`);
      setSelectedReceipt(null);
    } catch (error) {
      console.error("Erro ao restaurar itens:", error);
      showFeedback('error', 'Erro ao reaproveitar os itens.');
    } finally {
      setRestoring(false);
    }
  };

  const toggleSplitMember = (memberId: string) => {
    setSplitMembers(prev => 
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  const copyPixMessage = (total: number, perPerson: number) => {
    const text = `🛒 *Compras no Carrin*\nTotal da compra: R$ ${total.toFixed(2)}\nDividido para ${splitMembers.length}: *R$ ${perPerson.toFixed(2)}* pra cada.\n\nJá podem mandar o Pix! 💸`;
    
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
    }
    
    setShowPixModal(false);
    showFeedback('success', 'Mensagem de cobrança copiada!');
  };

  if (loading) {
    return <p className="text-center text-gray-400 py-10">Carregando histórico...</p>;
  }

  const groupedHistory = historyList.reduce((acc: any, list: any) => {
    if (!list.completed_at) return acc;
    const date = new Date(list.completed_at);
    const monthYear = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    
    if (!acc[monthYear]) acc[monthYear] = [];
    acc[monthYear].push(list);
    return acc;
  }, {});

  return (
    <div className="p-6 pb-24 max-w-lg mx-auto relative">
      
      {feedback && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-card shadow-lg text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200 whitespace-nowrap w-max max-w-[95vw] overflow-hidden ${feedback.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {feedback.type === 'success' ? <Check size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
          <span className="truncate">{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="ml-2 opacity-75 hover:opacity-100 shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-carrin-dark">Histórico</h1>
        <p className="text-gray-500 text-sm">Registro das suas compras</p>
      </div>

      {historyList.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-card shadow-sm p-6">
          <p className="text-gray-400 mb-2 font-bold">Nenhuma compra finalizada.</p>
          <p className="text-xs text-gray-400">O registro da casa aparecerá aqui após você finalizar o Modo Mercado.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.keys(groupedHistory).map((monthYear) => (
            <div key={monthYear} className="space-y-4">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider pl-1 capitalize-first">
                {monthYear}
              </h2>
              
              <div className="space-y-3">
                {groupedHistory[monthYear].map((list: any) => {
                  const date = new Date(list.completed_at);
                  const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                  const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  
                  const itemsCount = list.shopping_items ? list.shopping_items.length : 0;
                  const total = list.total_amount || list.shopping_items?.reduce((sum: number, item: any) => sum + (Number(item.price) || 0), 0) || 0;
                  
                  const involvedUsersMap = new Map();
                  list.shopping_items?.forEach((i: any) => {
                    if (i.users) involvedUsersMap.set(i.users.id, i.users);
                  });
                  const involvedUsers = Array.from(involvedUsersMap.values());
                  
                  const mainUser = involvedUsers[0];
                  const finisherName = mainUser?.full_name || mainUser?.username?.replace('@', '') || 'Moradores';
                  const finisherAvatar = mainUser?.avatar_url;

                  return (
                    <div 
                      key={list.id} 
                      onClick={() => setSelectedReceipt(list)}
                      className="bg-white rounded-card p-4 shadow-sm border border-gray-100 cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all group"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 size={10} /> Concluída
                            </span>
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                              <Clock size={10} /> {formattedTime}
                            </span>
                          </div>
                          <p className="text-sm font-extrabold text-carrin-dark flex items-center gap-1.5">
                            <Calendar size={14} className="text-emerald-600" /> {formattedDate}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-extrabold text-carrin-dark flex items-center justify-end gap-1">
                            <span className="text-xs font-bold text-gray-400">R$</span> 
                            {Number(total).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-50 pt-3">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <ShoppingBag size={14} /> {itemsCount} itens
                          </span>
                          <div className="flex items-center gap-1.5 font-medium text-carrin-dark">
                            {finisherAvatar ? (
                              <img src={finisherAvatar} alt="Avatar" className="w-4 h-4 rounded-full object-cover border border-gray-200" />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                <User size={10} />
                              </div>
                            )}
                            <span className="truncate max-w-[100px]">{finisherName}</span>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE RECIBO MINIMALISTA */}
      {selectedReceipt && (() => {
        const date = new Date(selectedReceipt.completed_at);
        const fullDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        const allItems = selectedReceipt.shopping_items || [];
        const boughtItems = allItems.filter((i: any) => i.is_completed);
        const unboughtItems = allItems.filter((i: any) => !i.is_completed);
        
        const total = selectedReceipt.total_amount || boughtItems.reduce((sum: number, item: any) => sum + (Number(item.price) || 0), 0) || 0;
        
        const mostExpensive = boughtItems.reduce((prev: any, current: any) => {
          return (Number(prev?.price) || 0) > (Number(current.price) || 0) ? prev : current;
        }, null);

        const involvedUsersMap = new Map();
        allItems.forEach((i: any) => {
          if (i.users) involvedUsersMap.set(i.users.id, i.users);
        });
        const involvedUsers = Array.from(involvedUsersMap.values());
        
        const mainUser = involvedUsers[0];
        const finisherName = mainUser?.full_name || mainUser?.username || 'Moradores';
        const finisherAvatar = mainUser?.avatar_url;
        const involvedCount = involvedUsers.length;

        return (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#FAFAFA] w-full max-w-md max-h-[85vh] rounded-card shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              
              <div className="bg-white p-5 border-b border-dashed border-gray-300 relative shrink-0">
                <button 
                  onClick={() => setSelectedReceipt(null)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-carrin-dark bg-gray-50 hover:bg-gray-100 p-1.5 rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
                <h2 className="text-xl font-extrabold text-carrin-dark mb-1">Recibo da Compra</h2>
                <p className="text-xs text-gray-500 font-medium">{fullDate} às {time}</p>
                
                <div className="mt-4 p-3 bg-gray-50 rounded-small border border-gray-100 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Colaboradores</p>
                    <div className="flex items-center gap-2">
                      {finisherAvatar ? (
                        <img src={finisherAvatar} alt="Avatar" className="w-6 h-6 rounded-full object-cover border border-gray-200 shadow-sm" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 shadow-sm">
                          <User size={14} />
                        </div>
                      )}
                      <p className="text-sm font-bold text-carrin-dark truncate max-w-[120px]">{finisherName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total</p>
                    <p className="text-lg font-extrabold text-emerald-600 flex items-center justify-end gap-1">
                      <span className="text-xs font-bold text-emerald-600/70">R$</span>
                      {Number(total).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 overflow-y-auto space-y-6">
                
                {/* BOTÃO DE DIVISÃO VIA PIX */}
                {total > 0 && homeMembers.length > 1 && (
                  <button
                    onClick={() => {
                      // Por padrão, seleciona todos os moradores da casa
                      setSplitMembers(homeMembers.map(m => m.users?.id).filter(Boolean));
                      setShowPixModal(true);
                    }}
                    className="w-full bg-emerald-50 text-emerald-700 py-3 rounded-small text-xs font-bold flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all shadow-sm border border-emerald-100"
                  >
                    <Wallet size={16} />
                    <span>Dividir Conta desta Compra</span>
                  </button>
                )}

                {mostExpensive && Number(mostExpensive.price) > 0 && (
                  <div className="flex items-center gap-3 bg-orange-50 text-orange-800 p-3 rounded-small border border-orange-100">
                    <div className="bg-orange-100 p-1.5 rounded-full shrink-0">
                      <TrendingUp size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] uppercase font-bold tracking-wider opacity-75">Maior Gasto</p>
                      <div className="flex justify-between items-center text-sm font-bold mt-0.5">
                        <span className="truncate pr-2">{mostExpensive.name}</span>
                        <span>R$ {Number(mostExpensive.price).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {boughtItems.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-dashed border-gray-200 pb-2">
                      Comprados ({boughtItems.length})
                    </h3>
                    <div className="space-y-2">
                      {boughtItems.map((item: any) => (
                        <div key={item.id} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2 overflow-hidden pr-2">
                            <span className="text-emerald-500 shrink-0"><CheckCircle2 size={14} /></span>
                            <span className="text-carrin-dark font-medium truncate">{item.name}</span>
                            {item.quantity && <span className="text-xs text-gray-400 shrink-0">x{item.quantity}</span>}
                          </div>
                          <span className="font-bold text-gray-700 shrink-0">
                            R$ {Number(item.price || 0).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {unboughtItems.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3 border-b border-dashed border-red-200 pb-2 flex items-center justify-between">
                      <span>Faltaram ({unboughtItems.length})</span>
                    </h3>
                    
                    <div className="space-y-2 mb-4">
                      {unboughtItems.map((item: any) => (
                        <div key={item.id} className="flex items-center gap-2 text-sm opacity-60">
                          <span className="text-gray-400 shrink-0"><X size={14} /></span>
                          <span className="text-gray-600 line-through truncate">{item.name}</span>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={() => handleRestoreUnboughtItems(unboughtItems)}
                      disabled={restoring}
                      className="w-full bg-carrin-dark text-white py-2.5 rounded-small text-xs font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all shadow-sm disabled:opacity-50"
                    >
                      <RotateCcw size={14} />
                      <span>{restoring ? 'Restaurando...' : 'Reaproveitar itens faltantes'}</span>
                    </button>
                  </div>
                )}

                {selectedReceipt.receipt_urls && selectedReceipt.receipt_urls.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-dashed border-gray-200 pb-2">
                      Comprovantes
                    </h3>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {selectedReceipt.receipt_urls.map((url: string, i: number) => (
                        <button 
                          key={i}
                          onClick={() => setExpandedImage(url)}
                          className="relative w-16 h-16 flex-shrink-0 rounded-small overflow-hidden border border-gray-200 shadow-sm hover:border-emerald-500 transition-colors"
                        >
                          <img src={url} alt={`Comprovante ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {involvedCount > 1 && (
                  <div className="pt-4 border-t border-dashed border-gray-300 text-center">
                    <p className="text-[10px] text-gray-400 font-medium">
                      Compra construída com a colaboração de {involvedCount} moradores da casa.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL DE DIVISÃO DE CONTA (PIX) */}
      {showPixModal && selectedReceipt && (() => {
        const total = selectedReceipt.total_amount || 0;
        const count = splitMembers.length;
        const perPerson = count > 0 ? total / count : 0;

        return (
          <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-card shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 p-5">
              <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2 text-carrin-dark">
                  <Wallet size={20} className="text-emerald-600" />
                  <h3 className="text-lg font-bold">Acerto de Contas</h3>
                </div>
                <button onClick={() => setShowPixModal(false)} className="text-gray-400 hover:text-carrin-dark p-1 bg-gray-50 rounded-full">
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-gray-500 mb-3">Selecione quem vai participar da divisão deste recibo de <strong className="text-carrin-dark">R$ {total.toFixed(2)}</strong>.</p>
              
              <div className="space-y-2 mb-6 max-h-48 overflow-y-auto pr-1">
                {homeMembers.map(member => {
                  const u = member.users;
                  if (!u) return null;
                  const isSelected = splitMembers.includes(u.id);
                  
                  return (
                    <div 
                      key={u.id} 
                      onClick={() => toggleSplitMember(u.id)}
                      className={`flex items-center gap-3 p-2.5 rounded-small cursor-pointer border transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 bg-white hover:bg-gray-50'}`}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 text-transparent'}`}>
                        <Check size={12} strokeWidth={3} />
                      </div>
                      
                      <div className="flex items-center gap-2 overflow-hidden">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="Avatar" className="w-6 h-6 rounded-full object-cover border border-gray-200" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                            <User size={12} />
                          </div>
                        )}
                        <span className={`text-sm font-bold truncate ${isSelected ? 'text-emerald-800' : 'text-gray-600'}`}>
                          {u.full_name || u.username} {u.id === user?.id ? '(Você)' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-gray-50 p-4 rounded-small border border-gray-100 text-center mb-4">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">Fica para cada ({count})</p>
                <p className="text-2xl font-extrabold text-carrin-dark flex items-center justify-center gap-1">
                  <span className="text-sm font-bold text-gray-400">R$</span> {perPerson.toFixed(2)}
                </p>
              </div>

              <button 
                onClick={() => copyPixMessage(total, perPerson)}
                disabled={count === 0}
                className="w-full bg-emerald-600 text-white py-3 rounded-small text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-sm"
              >
                <Copy size={16} />
                <span>Copiar Resumo de Cobrança</span>
              </button>
            </div>
          </div>
        );
      })()}

      {expandedImage && (
        <div className="fixed inset-0 z-[80] bg-black/95 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
          <button 
            onClick={() => setExpandedImage(null)}
            className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 p-2 rounded-full text-white transition-colors"
          >
            <X size={24} />
          </button>
          <img 
            src={expandedImage} 
            alt="Comprovante em tela cheia" 
            className="max-w-full max-h-[85vh] object-contain rounded-small shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}