import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { supabase } from '../../services/supabase';
import { historyService } from '../../services/historyService';
import { itemService } from '../../services/itemService';
import { homeService } from '../../services/homeService';
import { 
  Calendar, ShoppingBag, CheckCircle2, 
  X, Clock, User, TrendingUp, RotateCcw, ChevronRight, AlertCircle, Check, Wallet, Share2, Search, CopyPlus, Store, Edit2, Plus, Download
} from 'lucide-react';
import { useTutorialStore } from '../../stores/useTutorialStore';

interface HistoryProps {
  isActive?: boolean;
}

const normalizeStr = (str: string) => {
  return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
};

export function History({ isActive }: HistoryProps) {
  const { user, homeId } = useAuthStore();
  const { registerElement } = useTutorialStore();

  const [historyList, setHistoryList] = useState<any[]>([]);
  const [homeMembers, setHomeMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [buyAgainReceiptId, setBuyAgainReceiptId] = useState<string | null>(null);
  
  const [activeListNames, setActiveListNames] = useState<string[]>([]);
  
  const [restoring, setRestoring] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showPixModal, setShowPixModal] = useState(false);
  const [splitMembers, setSplitMembers] = useState<string[]>([]);

  const [buyAgainSelections, setBuyAgainSelections] = useState<Record<string, boolean>>({});
  const [buyingAgain, setBuyingAgain] = useState(false);
  const [preparingBuyAgain, setPreparingBuyAgain] = useState(false);

  const [isEditingMarket, setIsEditingMarket] = useState(false);
  const [editMarketName, setEditMarketName] = useState('');

  const selectedReceipt = historyList.find(r => r.id === selectedReceiptId) || null;
  const buyAgainReceipt = historyList.find(r => r.id === buyAgainReceiptId) || null;

  const isAnyModalOpen = !!(selectedReceiptId || showPixModal || expandedImage || buyAgainReceiptId);

  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isAnyModalOpen]);

const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const handleAddReceiptToHistory = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedReceipt || !homeId) return;

    const file = files[0];
    setUploadingReceipt(true);
    try {
      const url = await historyService.uploadReceipt(file, homeId);
      const newUrls = [...(selectedReceipt.receipt_urls || []), url];

      const { error } = await supabase
        .from('shopping_lists')
        .update({ receipt_urls: newUrls })
        .eq('id', selectedReceipt.id);

      if (error) throw error;

      // Atualiza o estado da lista recarregando a página silenciosamente, 
      // ou se você souber o nome do seu array (ex: setLists), troque window.location.reload() por:
      // setLists(prev => prev.map(item => item.id === selectedReceipt.id ? { ...item, receipt_urls: newUrls } : item));
      window.location.reload();
    } catch (error) {
      console.error('Erro ao adicionar comprovante:', error);
      alert('Erro ao adicionar comprovante.');
    } finally {
      setUploadingReceipt(false);
      e.target.value = ''; 
    }
  };

  const loadData = useCallback(async (isBackground = false) => {
    if (!homeId) return;
    if (!isBackground) setLoading(true);
    try {
      const [historyData, membersData] = await Promise.all([
        historyService.getHistory(homeId),
        homeService.getHomeMembers(homeId)
      ]);
      setHistoryList(historyData);
      setHomeMembers(membersData);
    } catch (error) {
      console.error("Erro ao carregar dados do histórico:", error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [homeId]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  useEffect(() => {
    if (isActive && homeId) {
      loadData(true);
    }
  }, [isActive, homeId, loadData]);

  useEffect(() => {
    if (!homeId) return;
    const channel = supabase
      .channel(`history_shopping_lists_${homeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_lists', filter: `home_id=eq.${homeId}` },
        () => { loadData(true); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [homeId, loadData]);

  useEffect(() => {
    if (selectedReceiptId && homeId) {
      itemService.getActiveMainListId(homeId).then(mainListId => {
        if (mainListId) {
          itemService.getItems(mainListId).then(items => {
            setActiveListNames(items.map(i => normalizeStr(i.name)));
          }).catch(console.error);
        }
      }).catch(console.error);
    }
  }, [selectedReceiptId, homeId]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const toggleSplitMember = (userId: string) => {
    setSplitMembers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleRestoreUnboughtItems = async (unboughtItems: any[]) => {
    if (!homeId || !user || unboughtItems.length === 0) return;
    setRestoring(true);
    
    try {
      const mainListId = await itemService.getActiveMainListId(homeId);
      if (!mainListId) throw new Error("Lista principal não encontrada");

      const currentActive = await itemService.getItems(mainListId);
      const currentNames = currentActive.map(i => normalizeStr(i.name));
      const itemsToAdd = unboughtItems.filter(item => !currentNames.includes(normalizeStr(item.name)));

      if (itemsToAdd.length === 0) {
        showFeedback('success', 'Todos os itens já estão na sua lista atual!');
        return;
      }

      await Promise.all(itemsToAdd.map(item => 
        itemService.addItem({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          observation: item.observation,
          category_id: item.category_id || '🛒 Mantimentos',
          home_id: homeId,
          shopping_list_id: mainListId,
          created_by: user.id
        } as any)
      ));
      
      const alreadyInList = unboughtItems.length - itemsToAdd.length;
      if (alreadyInList > 0) {
        showFeedback('success', `${itemsToAdd.length} adicionados. ${alreadyInList} já estavam na lista.`);
      } else {
        showFeedback('success', `${itemsToAdd.length} itens retornaram para a sua lista!`);
      }
      
      setActiveListNames([...currentNames, ...itemsToAdd.map(i => normalizeStr(i.name))]);
      
    } catch (error) {
      console.error("Erro ao restaurar itens:", error);
      showFeedback('error', 'Erro ao reaproveitar os itens.');
    } finally {
      setRestoring(false);
    }
  };

  const handleOpenBuyAgain = async (receiptId: string) => {
    setPreparingBuyAgain(true);
    try {
      const mainListId = await itemService.getActiveMainListId(homeId!);
      if (!mainListId) throw new Error("Lista principal não encontrada");

      const currentActive = await itemService.getItems(mainListId);
      const currentNormalizedNames = currentActive.map(i => normalizeStr(i.name));
      setActiveListNames(currentNormalizedNames);
      
      const initialSelections: Record<string, boolean> = {};
      const targetReceipt = historyList.find(r => r.id === receiptId);
      const boughtItems = targetReceipt?.shopping_items?.filter((i: any) => i.is_completed) || [];
      
      boughtItems.forEach((item: any) => {
        initialSelections[item.id] = !currentNormalizedNames.includes(normalizeStr(item.name));
      });
      
      setBuyAgainSelections(initialSelections);
      setBuyAgainReceiptId(receiptId);
    } catch (error) {
      console.error(error);
      showFeedback('error', 'Erro ao preparar itens.');
    } finally {
      setPreparingBuyAgain(false);
    }
  };

  const handleConfirmBuyAgain = async () => {
    if (!homeId || !user || !buyAgainReceipt) return;
    
    const boughtItems = buyAgainReceipt.shopping_items?.filter((i: any) => i.is_completed) || [];
    const itemsToAttempt = boughtItems.filter((i: any) => buyAgainSelections[i.id]);
    if (itemsToAttempt.length === 0) return;

    setBuyingAgain(true);
    try {
      const mainListId = await itemService.getActiveMainListId(homeId);
      if (!mainListId) throw new Error("Lista principal não encontrada");

      const currentActive = await itemService.getItems(mainListId);
      const currentNames = currentActive.map(i => normalizeStr(i.name));
      const itemsToAdd = itemsToAttempt.filter((item: any) => !currentNames.includes(normalizeStr(item.name)));

      if (itemsToAdd.length === 0) {
        showFeedback('success', 'Os itens selecionados já estão na sua lista!');
        setBuyAgainReceiptId(null);
        return;
      }

      await Promise.all(itemsToAdd.map((item: any) => 
        itemService.addItem({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          observation: item.observation,
          category_id: item.category_id || '🛒 Mantimentos',
          home_id: homeId,
          shopping_list_id: mainListId,
          created_by: user.id
        } as any)
      ));
      
      const alreadyInList = itemsToAttempt.length - itemsToAdd.length;
      if (alreadyInList > 0) {
        showFeedback('success', `${itemsToAdd.length} adicionados. ${alreadyInList} já estavam na lista.`);
      } else {
        showFeedback('success', `${itemsToAdd.length} itens adicionados à Lista!`);
      }
      
      setActiveListNames([...currentNames, ...itemsToAdd.map((i: any) => normalizeStr(i.name))]);
      setBuyAgainReceiptId(null); 
    } catch (error) {
      console.error("Erro ao adicionar itens comprados:", error);
      showFeedback('error', 'Erro ao adicionar os itens.');
    } finally {
      setBuyingAgain(false);
    }
  };

  const toggleBuyAgainSelection = (itemId: string) => {
    setBuyAgainSelections(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleSaveMarketEdit = async () => {
    if (!selectedReceipt) return;
    try {
      const newName = editMarketName.trim() || null;
      await historyService.updateMarketName(selectedReceipt.id, newName);
      setIsEditingMarket(false);
    } catch (err) {
      console.error(err);
      showFeedback('error', 'Erro ao atualizar o mercado.');
    }
  };

  const handleShareSimpleMessage = async (receipt: any) => {
    const date = new Date(receipt.completed_at).toLocaleDateString('pt-BR');
    const itemsCount = receipt.shopping_items ? receipt.shopping_items.length : 0;
    const total = receipt.total_amount || receipt.shopping_items?.reduce((sum: number, item: any) => sum + (Number(item.price) || 0), 0) || 0;
    const marketInfo = receipt.market_name ? `\n${receipt.market_name}` : '';

    const text = `🛒 *Compra no Carrin*\n${date}${marketInfo}\n${itemsCount} itens\nTotal: R$ ${Number(total).toFixed(2)}`;
    executeShare(text);
  };

  const handleSharePixMessage = async (total: number, perPerson: number) => {
    const text = `🛒 *Compras no Carrin*\nTotal da compra: R$ ${total.toFixed(2)}\nDividido para ${splitMembers.length}: *R$ ${perPerson.toFixed(2)}* pra cada.\n\nJá podem mandar o Pix! 💸`;
    executeShare(text);
    setShowPixModal(false);
  };

  const executeShare = async (text: string) => {
    const fallbackCopy = () => {
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
      showFeedback('success', 'Resumo copiado!');
    };

    if (navigator.share && window.isSecureContext) {
      try {
        await navigator.share({ title: 'Resumo da Compra - Carrin', text: text });
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error("Erro no Share API:", error);
          fallbackCopy();
        }
      }
    } else {
      fallbackCopy();
    }
  };

  // FLUXO DE DOWNLOAD/SHARE DE FOTO CORRIGIDO
  const handleDownloadReceipt = async (url: string) => {
    try {
      let blob: Blob;

      // 1. Obter a imagem resolvendo problemas de CORS (usando API nativa do Supabase)
      if (url.includes('/storage/v1/object/public/')) {
        const urlParts = url.split('/storage/v1/object/public/')[1].split('/');
        const bucket = urlParts[0];
        const path = urlParts.slice(1).join('/');
        
        const { data, error } = await supabase.storage.from(bucket).download(path);
        if (error) throw error;
        blob = data as Blob;
      } else {
        // Fallback caso a imagem venha de outro lugar
        const response = await fetch(url);
        if (!response.ok) throw new Error('Falha no fetch da imagem.');
        blob = await response.blob();
      }

      // 2. O iOS Safari REJEITA navigator.share se o tipo for application/octet-stream.
      let mimeType = blob.type;
      if (!mimeType || mimeType === 'application/octet-stream') {
        mimeType = url.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      }
      
      const date = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const ext = mimeType === 'image/png' ? 'png' : 'jpg';
      const filename = `carrin-comprovante-${date}.${ext}`;
      
      // 3. Criamos o Objeto File Real com o MIME type correto para o iPhone
      const file = new File([blob], filename, { type: mimeType });

      // 4. Fluxo MOBILE: Verifica se o aparelho suporta compartilhar arquivos
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Comprovante Carrin'
        });
      } else {
        // 5. Fluxo DESKTOP / Fallback: Download invisível
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      }
    } catch (e: any) {
      console.error("Erro ao salvar comprovante:", e);
      if (e.name !== 'AbortError') {
        showFeedback('error', 'Não foi possível salvar o comprovante.');
      }
    }
  };

  if (loading) {
    return <p className="text-center text-gray-400 py-10">Carregando histórico...</p>;
  }

  const filteredHistoryList = historyList.filter(list => {
    if (!searchQuery) return true;
    const q = normalizeStr(searchQuery);
    return list.shopping_items?.some((item: any) => normalizeStr(item.name).includes(q));
  });

  const groupedHistory = filteredHistoryList.reduce((acc: any, list: any) => {
    if (!list.completed_at) return acc;
    const date = new Date(list.completed_at);
    const monthYear = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    
    if (!acc[monthYear]) acc[monthYear] = { lists: [], count: 0, totalSpent: 0 };
    
    const total = list.total_amount || list.shopping_items?.reduce((sum: number, item: any) => sum + (Number(item.price) || 0), 0) || 0;
    
    acc[monthYear].lists.push(list);
    acc[monthYear].count += 1;
    acc[monthYear].totalSpent += total;
    
    return acc;
  }, {});

  return (
    <div className="p-6 pb-24 max-w-lg mx-auto relative">
      
      {feedback && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300 whitespace-nowrap w-max max-w-[95vw] overflow-hidden ${feedback.type === 'success' ? 'bg-carrin-primary text-white' : 'bg-red-600 text-white'}`}>
          {feedback.type === 'success' ? <Check size={18} className="shrink-0 text-white" /> : <AlertCircle size={18} className="shrink-0" />}
          <span className="truncate">{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="ml-2 opacity-80 hover:opacity-100 shrink-0 flex items-center">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-carrin-dark">Histórico</h1>
        <p className="text-gray-500 text-sm">Registro das suas compras</p>
      </div>

      {historyList.length > 0 && (
        <div className="relative mb-6">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar produto no histórico"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-100 rounded-small text-sm focus:outline-none focus:border-emerald-600 transition-colors shadow-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-3.5 text-gray-400 hover:text-carrin-dark">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {filteredHistoryList.length === 0 ? (
        <div ref={(el) => registerElement('history-main-area', el)} className="text-center py-12 bg-white rounded-card shadow-sm p-6">
          <p className="text-gray-400 mb-2 font-bold">{searchQuery ? 'Nenhum resultado encontrado.' : 'Nenhuma compra finalizada.'}</p>
          <p className="text-xs text-gray-400">{searchQuery ? 'Tente buscar por outro termo.' : 'O registro da casa aparecerá aqui após você finalizar o Modo Mercado.'}</p>
        </div>
      ) : (
        <div ref={(el) => registerElement('history-main-area', el)} className="space-y-8">
          {Object.keys(groupedHistory).map((monthYear) => {
            const data = groupedHistory[monthYear];
            const avg = data.count > 0 ? data.totalSpent / data.count : 0;

            return (
              <div key={monthYear} className="space-y-4">
                <div className="pl-1">
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider capitalize-first mb-0.5">
                    {monthYear}
                  </h2>
                  <p className="text-[10px] font-medium text-gray-400">
                    {data.count} {data.count === 1 ? 'compra' : 'compras'} • R$ {data.totalSpent.toFixed(2)} gastos • média R$ {avg.toFixed(2)}
                  </p>
                </div>
                
                <div className="space-y-3">
                  {data.lists.map((list: any) => {
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
                        onClick={() => setSelectedReceiptId(list.id)}
                        className="bg-white rounded-card p-4 shadow-sm border border-gray-100 cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all group flex flex-col gap-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 size={10} /> Concluída
                              </span>
                              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                <Clock size={10} /> {formattedTime}
                              </span>
                            </div>

                            {/* EXIBIÇÃO: Lista Rápida */}
                            {list.list_type === 'quick' && (
                              <div className="mb-1.5 flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-small uppercase tracking-wider flex items-center gap-1 w-max">
                                  Lista Rápida
                                </span>
                                <span className="text-xs font-extrabold text-carrin-dark truncate max-w-[120px]">
                                  {list.name || 'Lista Rápida'}
                                </span>
                              </div>
                            )}

                            {list.market_name && (
                              <p className="text-[11px] font-extrabold uppercase tracking-wider text-carrin-dark flex items-center gap-1 mb-1">
                                <Store size={12} className="text-gray-400" /> {list.market_name}
                              </p>
                            )}
                            <p className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
                              <Calendar size={12} className="text-gray-400" /> {formattedDate}
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
            );
          })}
        </div>
      )}

      {selectedReceipt && (() => {
        const date = new Date(selectedReceipt.completed_at);
        const fullDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        const allItems = selectedReceipt.shopping_items || [];
        const boughtItems = allItems.filter((i: any) => i.is_completed);
        const unboughtItems = allItems.filter((i: any) => !i.is_completed);
        
        const total = selectedReceipt.total_amount || boughtItems.reduce((sum: number, item: any) => sum + (Number(item.price) || 0), 0) || 0;
        
        const currentIndex = historyList.findIndex(h => h.id === selectedReceipt.id);
        const prevReceipt = (currentIndex >= 0 && currentIndex < historyList.length - 1) ? historyList[currentIndex + 1] : null;
        let diffText = null;
        let diffColor = "text-gray-400";
        if (prevReceipt) {
          const prevTotal = prevReceipt.total_amount || prevReceipt.shopping_items?.reduce((sum: number, item: any) => sum + (Number(item.price) || 0), 0) || 0;
          const diff = total - prevTotal;
          if (Math.abs(diff) < 0.01) {
            diffText = "Mesmo total da compra anterior";
          } else if (diff > 0) {
            diffText = `R$ ${diff.toFixed(2)} a mais que a compra anterior`;
            diffColor = "text-red-400";
          } else {
            diffText = `R$ ${Math.abs(diff).toFixed(2)} a menos que a compra anterior`;
            diffColor = "text-emerald-500";
          }
        }

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
                  onClick={() => {
                    setSelectedReceiptId(null);
                    setIsEditingMarket(false);
                  }}
                  className="absolute top-4 right-4 text-gray-400 hover:text-carrin-dark bg-gray-50 hover:bg-gray-100 p-1.5 rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
                <h2 className="text-xl font-extrabold text-carrin-dark mb-1">Recibo da Compra</h2>
                
                {/* EXIBIÇÃO: Lista Rápida no Modal */}
                {selectedReceipt.list_type === 'quick' && (
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-small uppercase tracking-wider flex items-center gap-1 w-max">
                      Lista Rápida
                    </span>
                    <span className="text-xs font-extrabold text-gray-600 truncate max-w-[150px]">
                      {selectedReceipt.name || 'Lista Rápida'}
                    </span>
                  </div>
                )}
                
                <p className="text-xs text-gray-500 font-medium">{fullDate} às {time}</p>
                
                <div className="mt-3">
                  {isEditingMarket ? (
                    <div className="flex gap-2 items-center">
                      <input 
                        type="text" 
                        autoFocus
                        placeholder="Nome do mercado"
                        value={editMarketName}
                        onChange={(e) => setEditMarketName(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-emerald-500"
                      />
                      <button onClick={handleSaveMarketEdit} className="bg-emerald-600 text-white p-1.5 rounded hover:bg-emerald-700">
                        <Check size={16} />
                      </button>
                      <button onClick={() => setIsEditingMarket(false)} className="bg-gray-100 text-gray-600 p-1.5 rounded hover:bg-gray-200">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group w-max">
                      {selectedReceipt.market_name ? (
                        <>
                          <Store size={14} className="text-gray-400" />
                          <span className="text-sm font-extrabold uppercase text-carrin-dark tracking-wider">{selectedReceipt.market_name}</span>
                          <button 
                            onClick={() => { setEditMarketName(selectedReceipt.market_name); setIsEditingMarket(true); }}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-emerald-600 transition-all p-1"
                          >
                            <Edit2 size={12} />
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => { setEditMarketName(''); setIsEditingMarket(true); }}
                          className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-full transition-colors flex items-center gap-1"
                        >
                          <Plus size={12} /> Adicionar mercado
                        </button>
                      )}
                    </div>
                  )}
                </div>

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
                {diffText && (
                  <p className={`text-[10px] font-bold text-right mt-1.5 ${diffColor}`}>
                    {diffText}
                  </p>
                )}
              </div>

              <div className="p-5 overflow-y-auto space-y-6">
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handleShareSimpleMessage(selectedReceipt)}
                    className="flex-1 bg-white text-carrin-dark py-2.5 rounded-small text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-gray-50 transition-all shadow-sm border border-gray-200"
                  >
                    <Share2 size={14} /> Compartilhar Resumo
                  </button>
                  {total > 0 && homeMembers.length > 1 && (
                    <button
                      onClick={() => {
                        setSplitMembers(homeMembers.map(m => m.users?.id).filter(Boolean));
                        setShowPixModal(true);
                      }}
                      className="flex-1 bg-emerald-50 text-emerald-700 py-2.5 rounded-small text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-100 transition-all shadow-sm border border-emerald-100"
                    >
                      <Wallet size={14} /> Dividir Conta
                    </button>
                  )}
                </div>

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
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-dashed border-gray-200 pb-2 flex justify-between items-center">
                      <span>Comprados ({boughtItems.length})</span>
                    </h3>
                    <div className="space-y-2 mb-4">
                      {boughtItems.map((item: any) => (
                        <div key={item.id} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2 overflow-hidden pr-2">
                            <span className="text-emerald-500 shrink-0"><CheckCircle2 size={14} /></span>
                            <div className="flex flex-col">
                              <span className="text-carrin-dark font-medium truncate">{item.name}</span>
                              {item.bought_quantity > 0 && item.unit_price > 0 && (
                                <span className="text-[10px] text-gray-400 font-medium leading-none">
                                  {item.bought_quantity} {item.unit || 'und'} × R$ {Number(item.unit_price).toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="font-bold text-gray-700 shrink-0">
                            R$ {Number(item.price || 0).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={() => handleOpenBuyAgain(selectedReceipt.id)}
                      disabled={preparingBuyAgain}
                      className="w-full bg-carrin-dark text-white py-2.5 rounded-small text-xs font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all shadow-sm disabled:opacity-50"
                    >
                      <CopyPlus size={14} />
                      <span>{preparingBuyAgain ? 'Preparando...' : 'Comprar novamente'}</span>
                    </button>
                  </div>
                )}

                {unboughtItems.length > 0 && (() => {
                  const allUnboughtAreInList = unboughtItems.length > 0 && unboughtItems.every((i: any) => activeListNames.includes(normalizeStr(i.name)));
                  
                  return (
                    <div>
                      <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3 border-b border-dashed border-red-200 pb-2 flex items-center justify-between">
                        <span>Faltaram ({unboughtItems.length})</span>
                      </h3>
                      
                      <div className="space-y-2 mb-4">
                        {unboughtItems.map((item: any) => {
                          const inList = activeListNames.includes(normalizeStr(item.name));
                          return (
                            <div key={item.id} className="flex items-center gap-2 text-sm opacity-60">
                              <span className="text-gray-400 shrink-0"><X size={14} /></span>
                              <span className="text-gray-600 line-through truncate">{item.name}</span>
                              {inList && <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold ml-auto">Já na lista</span>}
                            </div>
                          );
                        })}
                      </div>

                      <button 
                        onClick={() => handleRestoreUnboughtItems(unboughtItems)}
                        disabled={restoring || allUnboughtAreInList}
                        className="w-full bg-white border border-gray-200 text-carrin-dark py-2.5 rounded-small text-xs font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
                      >
                        {restoring ? (
                          <>
                            <RotateCcw size={14} className="animate-spin" /> Restaurando...
                          </>
                        ) : allUnboughtAreInList ? (
                          <>
                            <Check size={14} className="text-emerald-600" /> <span className="text-emerald-700">Adicionado à lista ✓</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw size={14} /> Reaproveitar itens faltantes
                          </>
                        )}
                      </button>
                    </div>
                  );
                })()}

                {selectedReceipt.payment_methods && selectedReceipt.payment_methods.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-dashed border-gray-200 pb-2">
                      Pagamento
                    </h3>
                    <div className="space-y-2 mb-6">
                      {selectedReceipt.payment_methods.map((p: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-sm border border-gray-100 rounded-small p-2.5 shadow-sm bg-white">
                          <span className="font-bold text-gray-600">{p.method}</span>
                          <span className="font-extrabold text-carrin-dark">R$ {(p.amount_cents / 100).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

               <div className="mt-6">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-dashed border-gray-200 pb-2">
                    Comprovantes
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {selectedReceipt.receipt_urls?.map((url: string, i: number) => (
                      <div key={i} onClick={() => setExpandedImage(url)} className="block cursor-pointer">
                        <img src={url} alt={`Comprovante ${i + 1}`} className="w-16 h-16 object-cover rounded-small border border-gray-200 hover:opacity-80 transition-opacity" />
                      </div>
                    ))}
                    
                    {(!selectedReceipt.receipt_urls || selectedReceipt.receipt_urls.length < 3) && (
                      <label className="w-16 h-16 rounded-small border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:text-emerald-600 hover:border-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer">
                        {uploadingReceipt ? (
                          <span className="animate-spin border-2 border-emerald-600 border-t-transparent rounded-full w-5 h-5"></span>
                        ) : (
                          <span className="text-2xl leading-none">+</span>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={handleAddReceiptToHistory} disabled={uploadingReceipt} />
                      </label>
                    )}
                  </div>
                </div>
                
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

      {buyAgainReceipt && (() => {
        const itemsToSelect = buyAgainReceipt.shopping_items?.filter((i: any) => i.is_completed) || [];
        const selectedCount = itemsToSelect.filter((i: any) => buyAgainSelections[i.id] && !activeListNames.includes(normalizeStr(i.name))).length;

        return (
          <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm max-h-[85vh] rounded-card shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-5 border-b border-gray-100 shrink-0">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2 text-carrin-dark">
                    <CopyPlus size={20} className="text-emerald-600" />
                    <h3 className="text-lg font-bold">Comprar Novamente</h3>
                  </div>
                  <button onClick={() => setBuyAgainReceiptId(null)} className="text-gray-400 hover:text-carrin-dark p-1 bg-gray-50 rounded-full">
                    <X size={16} />
                  </button>
                </div>
                <p className="text-xs text-gray-500">Selecione os itens que deseja enviar de volta para sua Lista principal. Itens que já estão pendentes na sua casa foram desmarcados.</p>
              </div>

              <div className="p-5 overflow-y-auto space-y-1">
                {itemsToSelect.map((item: any) => {
                  const inList = activeListNames.includes(normalizeStr(item.name));
                  const isSelected = buyAgainSelections[item.id] && !inList;
                  
                  return (
                    <div 
                      key={item.id} 
                      onClick={() => !inList && toggleBuyAgainSelection(item.id)}
                      className={`flex items-center justify-between p-3 rounded-small border transition-all ${inList ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-100' : isSelected ? 'border-emerald-500 bg-emerald-50 cursor-pointer' : 'border-gray-100 bg-white hover:bg-gray-50 cursor-pointer'}`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 transition-colors ${inList ? 'border-gray-300 bg-gray-100' : isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 text-transparent bg-white'}`}>
                          <Check size={14} strokeWidth={3} />
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className={`text-sm font-bold truncate ${inList ? 'text-gray-500' : isSelected ? 'text-emerald-800' : 'text-gray-600'}`}>
                            {item.name}
                          </span>
                          {(item.quantity || item.unit) && (
                            <span className={`text-[10px] font-medium ${isSelected && !inList ? 'text-emerald-600/70' : 'text-gray-400'}`}>
                              {item.quantity} {item.unit}
                            </span>
                          )}
                        </div>
                      </div>
                      {inList && (
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">Já na lista</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="p-5 border-t border-gray-100 shrink-0">
                <button 
                  onClick={handleConfirmBuyAgain}
                  disabled={selectedCount === 0 || buyingAgain}
                  className="w-full bg-emerald-600 text-white py-3 rounded-small text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-sm"
                >
                  {buyingAgain ? 'Adicionando...' : `Adicionar à Lista Principal (${selectedCount})`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
                onClick={() => handleSharePixMessage(total, perPerson)}
                disabled={count === 0}
                className="w-full bg-emerald-600 text-white py-3 rounded-small text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-sm"
              >
                <Share2 size={16} />
                <span>Compartilhar Resumo</span>
              </button>
            </div>
          </div>
        );
      })()}

      {expandedImage && (
        <div className="fixed inset-0 z-[80] bg-black/95 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute top-6 right-6 flex gap-3 z-50">
            <button 
              onClick={() => handleDownloadReceipt(expandedImage)} 
              className="bg-white/10 hover:bg-white/20 p-2.5 rounded-full text-white transition-colors"
              title="Salvar comprovante"
            >
              <Download size={24} />
            </button>
            <button 
              onClick={() => setExpandedImage(null)} 
              className="bg-white/10 hover:bg-white/20 p-2.5 rounded-full text-white transition-colors"
              title="Fechar"
            >
              <X size={24} />
            </button>
          </div>
          <img src={expandedImage} alt="Comprovante em tela cheia" className="max-w-full max-h-[85vh] object-contain rounded-small shadow-2xl" />
        </div>
      )}
    </div>
  );
}