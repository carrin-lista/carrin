import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { ShoppingItemCard } from '../../components/ShoppingItemCard';
import { BottomNav } from '../../components/BottomNav';
import { AddItemModal } from './AddItemModal';
import { FinishShoppingModal } from './FinishShoppingModal';
import { Settings } from '../settings/Settings';
import { History } from '../history/History';
import { Home } from '../home/Home';
import { useAuthStore } from '../../stores/useAuthStore';
import { itemService } from '../../services/itemService';
import { historyService } from '../../services/historyService';
import { CheckCheck, ShoppingCart, X, AlertCircle, Play, Search, ListFilter, Plus } from 'lucide-react';
import { NotificationBell } from '../notifications/NotificationBell';

const EMPTY_MESSAGES = [
  "Quando algo acabar em casa, coloque aqui.",
  "Geladeira vazia? Anote tudo o que precisa.",
  "Nada faltando no momento. Que paz!",
  "Sua lista está limpa. Aproveite para planejar o próximo mercado.",
  "Não deixe para lembrar no corredor. Anote agora!",
  "Tudo abastecido! Adicione itens quando precisar."
];

export function ShoppingList() {
  const { user, homeId } = useAuthStore();
  const [currentTab, setCurrentTab] = useState(() => {
    return localStorage.getItem('carrin_current_tab') || 'list';
  });
  const [items, setItems] = useState<any[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'category' | 'alphabetical' | 'recent'>('category');
  const [emptyMessage, setEmptyMessage] = useState(EMPTY_MESSAGES[0]);

  const [isMarketMode, setIsMarketMode] = useState(() => {
    return localStorage.getItem('carrin_is_market_mode') === 'true';
  });

  const [hasActiveMarketSession, setHasActiveMarketSession] = useState(() => {
    return localStorage.getItem('carrin_market_session_active') === 'true';
  });
  
  const [showFabTooltip, setShowFabTooltip] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  
  const [priceModalItem, setPriceModalItem] = useState<any | null>(null);
  const [priceInput, setPriceInput] = useState('');

  const [itemToUncheck, setItemToUncheck] = useState<any | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);

  const fetchItems = async () => {
    if (!homeId) return;
    try {
      const data = await itemService.getItems(homeId);
      setItems(data);
    } catch (error) {
      console.error("Erro ao buscar itens atualizados:", error);
    }
  };

  useEffect(() => {
    localStorage.setItem('carrin_current_tab', currentTab);
  }, [currentTab]);

  useEffect(() => {
    async function loadData() {
      if (!homeId) return;
      try {
        const listId = await itemService.getActiveListId(homeId);
        setActiveListId(listId);
        await fetchItems();
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();

    if (!homeId) return;

    const channel = supabase
      .channel(`home_items_${homeId}`)
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'shopping_items',
          filter: `home_id=eq.${homeId}`, 
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setItems(current => current.some(i => i.id === payload.new.id) ? current : [payload.new, ...current]);
          } else if (payload.eventType === 'UPDATE') {
            setItems(current => current.map(i => i.id === payload.new.id ? { ...i, ...payload.new } : i));
          } else if (payload.eventType === 'DELETE') {
            setItems(current => current.filter(i => i.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [homeId]);

  useEffect(() => {
    localStorage.setItem('carrin_is_market_mode', String(isMarketMode));
    if (isMarketMode) {
      localStorage.setItem('carrin_market_session_active', 'true');
      setHasActiveMarketSession(true);
      
      setShowFabTooltip(true);
      const timer = setTimeout(() => setShowFabTooltip(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setShowFabTooltip(false);
    }
  }, [isMarketMode]);

  useEffect(() => {
    if (items.length === 0 && !loading) {
      setEmptyMessage(EMPTY_MESSAGES[Math.floor(Math.random() * EMPTY_MESSAGES.length)]);
    }
  }, [items.length, loading]);

  const handleToggleMarketMode = () => {
    if (!isMarketMode) {
      const seenTutorial = localStorage.getItem('carrin_market_tutorial_seen');
      if (!seenTutorial) {
        setShowTutorial(true);
        return;
      }
      setIsMarketMode(true);
    } else {
      setIsMarketMode(false);
    }
  };

  const handleCancelMarketSession = () => {
    setIsMarketMode(false);
    setHasActiveMarketSession(false);
    localStorage.removeItem('carrin_is_market_mode');
    localStorage.removeItem('carrin_market_session_active');
  };

  const confirmTutorialAndEnter = () => {
    localStorage.setItem('carrin_market_tutorial_seen', 'true');
    setShowTutorial(false);
    setIsMarketMode(true);
  };

  const handleToggle = async (item: any) => {
    const nextStatus = !item.is_completed;

    if (isMarketMode && nextStatus) {
      setPriceModalItem(item);
      setPriceInput(item.price ? item.price.toString() : '');
      return;
    }

    if (!nextStatus && item.price > 0) {
      setItemToUncheck(item);
      return;
    }

    executeToggle(item.id, nextStatus, nextStatus ? item.price : 0);
  };

  const handleConfirmUncheck = () => {
    if (!itemToUncheck) return;
    executeToggle(itemToUncheck.id, false, 0);
    setItemToUncheck(null);
  };

  const executeToggle = async (itemId: string, isCompleted: boolean, price?: number) => {
    setItems(items.map(i => 
      i.id === itemId ? { ...i, is_completed: isCompleted, price: price !== undefined ? price : i.price } : i
    ));

    try {
      await itemService.toggleItemCompletion(itemId, isCompleted, price);
    } catch (error) {
      console.error("Erro ao atualizar item:", error);
    }
  };

  const handleSavePriceModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceModalItem) return;

    const parsedPrice = priceInput.trim() !== '' ? parseFloat(priceInput.replace(',', '.')) : 0;
    
    await executeToggle(priceModalItem.id, true, !isNaN(parsedPrice) ? parsedPrice : 0);
    setPriceModalItem(null);
    setPriceInput('');
  };

  const handleDelete = async (id: string) => {
    const previousItems = [...items];
    setItems(items.filter(item => item.id !== id));

    try {
      await itemService.deleteItem(id);
    } catch (error) {
      console.error("Erro ao deletar item:", error);
      setItems(previousItems);
    }
  };

  const handleSaveItem = async (name: string, quantity: string, observation: string, categoryId: string) => {
    if (!homeId || !user) return;

    const formattedData = {
      name: name.trim(),
      quantity: quantity ? quantity.trim() : undefined,
      observation: observation ? observation.trim() : undefined,
      category_id: categoryId || '🛒 Mantimentos'
    };

    if (editingItem) {
      setItems(items.map(item => 
        item.id === editingItem.id ? { ...item, ...formattedData } : item
      ));
      await itemService.updateItem(editingItem.id, formattedData);
    } else {
      const newItem = {
        ...formattedData,
        home_id: homeId,
        created_by: user.id
      };
      const savedItem = await itemService.addItem(newItem as any);
      if (savedItem) {
        setItems(prev => [savedItem, ...prev.filter(i => i.id !== savedItem.id)]);
      }
    }
    
    setEditingItem(null);
  };

  const handleOpenFinishModal = () => {
    if (!homeId || !activeListId) return;
    setIsFinishModalOpen(true);
  };

  const handleConfirmFinishShopping = async (receiptUrls: string[]) => {
    if (!homeId || !activeListId || finishing) return;

    setFinishing(true);
    try {
      const newListId = await historyService.finishActiveList(homeId, activeListId, totalEstimated, receiptUrls);
      setActiveListId(newListId);
      setItems([]);
    } catch (error) {
      console.error("Erro ao finalizar compra:", error);
      alert("Houve um erro ao salvar o histórico, mas sua lista foi concluída.");
    } finally {
      setIsMarketMode(false);
      setHasActiveMarketSession(false);
      localStorage.removeItem('carrin_is_market_mode');
      localStorage.removeItem('carrin_market_session_active');
      setFinishing(false);
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const realPendingCount = items.filter(item => !item.is_completed).length;
  const totalEstimated = items.reduce((sum, item) => {
    return sum + (item.is_completed && item.price ? Number(item.price) : 0);
  }, 0);

  const searchedItems = items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const pendingItems = searchedItems.filter(item => !item.is_completed);
  const completedItems = searchedItems.filter(item => item.is_completed);

  const renderPendingItems = () => {
    if (pendingItems.length === 0) return null;

    if (sortBy === 'category') {
      const groupedPending = pendingItems.reduce((acc: any, item: any) => {
        const cat = item.category_id || '🛒 Mantimentos';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
      }, {});

      const sortedCategories = Object.keys(groupedPending).sort();

      return (
        <div className="mb-6 space-y-6">
          {sortedCategories.map((category) => (
            <div key={category}>
              <h2 className={`font-bold text-gray-500 uppercase tracking-wider mb-3 ${isMarketMode ? 'text-base text-emerald-800' : 'text-sm'}`}>
                {category}
              </h2>
              <div className="space-y-2">
                {groupedPending[category].map((item: any) => (
                  <div key={item.id} className={isMarketMode ? 'py-1 text-lg' : ''}>
                    <ShoppingItemCard
                      name={item.name}
                      quantity={item.quantity}
                      observation={item.observation}
                      isCompleted={item.is_completed}
                      onToggle={() => handleToggle(item)}
                      onDelete={() => handleDelete(item.id)}
                      onEdit={() => openEditModal(item)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    const flatSorted = [...pendingItems].sort((a, b) => {
      if (sortBy === 'alphabetical') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'recent') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return 0;
    });

    return (
      <div className="mb-6 space-y-2">
        {flatSorted.map((item: any) => (
          <div key={item.id} className={isMarketMode ? 'py-1 text-lg' : ''}>
            <ShoppingItemCard
              name={item.name}
              quantity={item.quantity}
              observation={item.observation}
              isCompleted={item.is_completed}
              onToggle={() => handleToggle(item)}
              onDelete={() => handleDelete(item.id)}
              onEdit={() => openEditModal(item)}
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full min-h-screen bg-carrin-bg relative">
      
      {/* ABA 1: LISTA (Fica oculta se currentTab !== 'list') */}
      <div className={`w-full min-h-screen bg-carrin-bg ${isMarketMode ? 'pb-24' : 'pb-32'} ${currentTab === 'list' ? 'block' : 'hidden'}`}>
        
        {!isMarketMode && hasActiveMarketSession && (
          <div className="bg-emerald-800 text-white px-4 py-2.5 text-xs flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-emerald-300 animate-pulse" />
              <span className="font-semibold">Modo Mercado em andamento</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleCancelMarketSession}
                className="bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-100 px-3 py-1 rounded-small font-bold text-xs flex items-center gap-1 transition-all"
                title="Encerrar Sessão"
              >
                <X size={12} strokeWidth={3} />
                <span>Encerrar</span>
              </button>
              <button 
                onClick={() => setIsMarketMode(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-small font-bold text-xs flex items-center gap-1 shadow transition-all"
              >
                <Play size={12} fill="white" />
                <span>Retomar</span>
              </button>
            </div>
          </div>
        )}

        <div className="p-6 pb-2">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-carrin-dark">Sua Lista</h1>
              <p className="text-gray-500 text-sm">{isMarketMode ? 'Executando compras no corredor' : 'Compras da Casa'}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <NotificationBell />
              
              <button
                onClick={handleToggleMarketMode}
                className={`px-3.5 py-2.5 rounded-small text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                  isMarketMode 
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-300' 
                    : 'bg-white text-carrin-dark border border-gray-200 hover:border-carrin-primary'
                }`}
              >
                <ShoppingCart size={16} />
                <span>{isMarketMode ? 'Sair do Modo Mercado' : 'Modo Mercado'}</span>
              </button>
            </div>
          </div>
          
          {isMarketMode ? (
            <div className="bg-emerald-900 text-white p-4 rounded-card mb-6 flex justify-between items-center shadow-md animate-in fade-in duration-200">
              <div>
                <p className="text-xs text-emerald-300">Falta no Carrinho</p>
                <p className="text-2xl font-extrabold">{realPendingCount}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-emerald-300">Total Atual</p>
                <p className="text-2xl font-extrabold text-emerald-300 flex items-center justify-center gap-1">
                  <span className="text-sm font-bold opacity-80">R$</span>
                  {totalEstimated.toFixed(2)}
                </p>
              </div>
              {items.length > 0 && (
                <button
                  onClick={handleOpenFinishModal}
                  disabled={finishing}
                  className="bg-carrin-primary text-white text-xs px-3 py-2 rounded-small font-semibold flex items-center gap-1 hover:opacity-90 transition-all disabled:opacity-50 shadow"
                  title="Finalizar compra e arquivar lista"
                >
                  <CheckCheck size={16} />
                  <span>{finishing ? 'Finalizando...' : 'Finalizar'}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-carrin-dark text-white p-4 rounded-card mb-6 flex justify-between items-center shadow-sm">
              <div>
                <p className="text-xs text-gray-400">Total de itens</p>
                <p className="text-xl font-bold">{items.length}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Pendentes</p>
                <p className="text-xl font-bold">{realPendingCount}</p>
              </div>
            </div>
          )}

          {items.length > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar item..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-100 rounded-small text-sm focus:outline-none focus:border-emerald-600 transition-colors shadow-sm"
                />
              </div>
              <div className="relative shrink-0">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="appearance-none bg-white border border-gray-100 rounded-small pl-9 pr-8 py-2.5 text-sm text-carrin-dark font-semibold focus:outline-none focus:border-emerald-600 transition-colors cursor-pointer shadow-sm"
                >
                  <option value="category">Categorias</option>
                  <option value="recent">Recentes</option>
                  <option value="alphabetical">Alfabética</option>
                </select>
                <ListFilter size={14} className="absolute left-3 top-3.5 text-emerald-600 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        <div className="px-6">
          {loading ? (
            <p className="text-center text-gray-400 py-10">Carregando itens...</p>
          ) : items.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-card shadow-sm p-6 animate-in fade-in zoom-in duration-300">
              <p className="text-gray-400 mb-2 font-bold text-sm">Sua lista está vazia.</p>
              <p className="text-xs text-gray-400">{emptyMessage}</p>
            </div>
          ) : searchedItems.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-400 text-sm">Nenhum item encontrado para "{searchQuery}".</p>
            </div>
          ) : (
            <>
              {renderPendingItems()}

              {completedItems.length > 0 && (
                <div className="mt-8 pt-4 border-t border-gray-200">
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>Comprados ({completedItems.length})</span>
                  </h2>
                  <div className="space-y-2">
                    {completedItems.map((item: any) => (
                      <div key={item.id} className="relative">
                        <ShoppingItemCard
                          name={item.name}
                          quantity={item.quantity}
                          observation={item.observation}
                          isCompleted={item.is_completed}
                          onToggle={() => handleToggle(item)}
                          onDelete={undefined}
                          onEdit={() => openEditModal(item)}
                        />
                        {isMarketMode && item.price > 0 && (
                          <span className="absolute right-4 top-4 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-small">
                            R$ {Number(item.price).toFixed(2)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {!isMarketMode && (
          <div className="fixed bottom-20 left-0 w-full px-6 pointer-events-none">
            <button 
              onClick={openAddModal}
              className="w-full bg-carrin-primary text-white py-4 rounded-button font-semibold shadow-sm pointer-events-auto hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              <span>+ Adicionar Item</span>
            </button>
          </div>
        )}

        {isMarketMode && (
          <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
            {showFabTooltip && (
              <div className="bg-carrin-dark text-white text-xs font-bold px-3 py-2 rounded-xl shadow-xl relative animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-auto cursor-pointer" onClick={() => setShowFabTooltip(false)}>
                Faltou algo? Adicione aqui! 👀
                <div className="absolute -bottom-1.5 right-5 w-3 h-3 bg-carrin-dark rotate-45 rounded-sm"></div>
              </div>
            )}
            <button
              onClick={openAddModal}
              className="w-14 h-14 bg-carrin-primary text-white rounded-full shadow-xl flex items-center justify-center hover:bg-emerald-600 hover:scale-105 active:scale-95 transition-all pointer-events-auto"
              title="Adicionar item esquecido"
            >
              <Plus size={28} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>

      {/* ABA 2: HISTÓRICO */}
      <div className={currentTab === 'history' ? 'block' : 'hidden'}>
        <History />
      </div>

      {/* ABA 3: CASA */}
      <div className={currentTab === 'home' ? 'block' : 'hidden'}>
        <Home />
      </div>

      {/* ABA 4: AJUSTES */}
      <div className={currentTab === 'settings' ? 'block' : 'hidden'}>
        <Settings />
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE DESMARCAÇÃO */}
      {itemToUncheck && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <AlertCircle size={28} />
              <h3 className="text-xl font-extrabold text-carrin-dark">Desmarcar Item?</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-6">
              O item <strong>{itemToUncheck.name}</strong> já possui o valor de <strong className="text-emerald-600">R$ {Number(itemToUncheck.price).toFixed(2)}</strong>. Ao desmarcar, esse valor será zerado.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setItemToUncheck(null)}
                className="w-1/2 bg-gray-100 text-gray-600 py-3.5 rounded-button font-bold text-sm hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmUncheck}
                className="w-full bg-emerald-600 text-white py-3.5 rounded-button font-bold text-sm shadow hover:bg-emerald-700 transition-all"
              >
                Sim, Desmarcar
              </button>
            </div>
          </div>
        </div>
      )}

      {showTutorial && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <ShoppingCart size={28} />
              <h3 className="text-xl font-extrabold text-carrin-dark">Como utilizar o Modo Mercado</h3>
            </div>
            
            <div className="space-y-3 text-sm text-gray-600 mb-6">
              <p>Este modo foi desenhado para facilitar sua vida e do seu parceiro(a) <strong>fisicamente nos corredores do supermercado</strong>:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Toque rápido:</strong> Os itens ficam maiores e fáceis de marcar com uma mão só enquanto empurra o carrinho.</li>
                <li><strong>Preços em tempo real:</strong> Ao marcar um item como comprado, digite rapidamente o preço usando o teclado numérico.</li>
                <li><strong>Total do Carrinho:</strong> Acompanhe o valor acumulado da compra na hora para evitar surpresas no caixa.</li>
                <li><strong>Sessão inteligente:</strong> Se sair para adicionar um item esquecido, o app avisa que a compra continua ativa e permite retomar com 1 toque.</li>
              </ul>
            </div>

            <button
              onClick={confirmTutorialAndEnter}
              className="w-full bg-emerald-600 text-white py-3.5 rounded-button font-bold text-sm shadow hover:bg-emerald-700 transition-all"
            >
              Entendi, Entrar no Mercado
            </button>
          </div>
        </div>
      )}

      {priceModalItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-card p-6 shadow-xl animate-in fade-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-carrin-dark">Preço do Item</h3>
              <button onClick={() => setPriceModalItem(null)} className="text-gray-400 hover:text-carrin-dark">
                <X size={20} />
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Quanto custou <span className="font-bold text-carrin-dark">{priceModalItem.name}</span>?
            </p>

            <form onSubmit={handleSavePriceModal} className="flex flex-col gap-4">
              <div className="relative">
                <span className="absolute left-3 top-3.5 text-gray-400 font-bold">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  autoFocus
                  className="w-full pl-10 pr-3 py-3.5 bg-gray-50 border border-gray-200 rounded-small text-xl font-extrabold text-carrin-dark focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    executeToggle(priceModalItem.id, true, 0);
                    setPriceModalItem(null);
                  }}
                  className="w-1/2 bg-gray-100 text-gray-600 py-3 rounded-small font-semibold text-sm hover:bg-gray-200"
                >
                  Pular valor
                </button>
                <button
                  type="submit"
                  className="w-full bg-emerald-600 text-white py-3 rounded-small font-bold text-sm hover:bg-emerald-700"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AddItemModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingItem(null); }} 
        onSave={handleSaveItem}
        initialData={editingItem}
      />

      <FinishShoppingModal
        isOpen={isFinishModalOpen}
        onClose={() => setIsFinishModalOpen(false)}
        onConfirm={handleConfirmFinishShopping}
        totalAmount={totalEstimated}
        totalItems={completedItems.length}
        loading={finishing}
      />

      {/* Navegação Inferior Fixa */}
      {!isMarketMode && <BottomNav currentTab={currentTab} onTabChange={setCurrentTab} />}
    </div>
  );
}