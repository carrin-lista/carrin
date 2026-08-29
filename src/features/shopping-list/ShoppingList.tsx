import { useState, useEffect, useCallback } from 'react';
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
import { CheckCheck, ShoppingCart, X, AlertCircle, Play, Search, ListFilter, Plus, Minus, MoreVertical, Check, User, RotateCcw, PlusCircle, Edit2, ChevronLeft } from 'lucide-react';
import { NotificationBell } from '../notifications/NotificationBell';
import { PushPermissionModal } from './PushPermissionModal'; 
import { notificationService } from '../../services/notificationService';
import { preferenceService } from '../../services/preferenceService';
import { interpretBillingState } from '../../services/billingInterpreter';
import { useScrollLock } from '../../hooks/useScrollLock';

const EMPTY_MESSAGES = [
  "Quando algo acabar em casa, coloque aqui.",
  "Geladeira vazia? Anote tudo o que precisa.",
  "Nada faltando no momento. Que paz!",
  "Sua lista está limpa. Aproveite para planejar o próximo mercado.",
  "Não deixe para lembrar no corredor. Anote agora!",
  "Tudo abastecido! Adicione itens quando precisar."
];

const normalizeStr = (str: string) => {
  return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
};

export function ShoppingList() {
  const { user, homeId } = useAuthStore();

  const [hasError, setHasError] = useState(false);
  const [currentTab, setCurrentTab] = useState(() => localStorage.getItem('carrin_current_tab') || 'list');

  const [mainListId, setMainListId] = useState<string | null>(null);
  const [quickList, setQuickList] = useState<{ id: string, name: string | null } | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const selectedListType = selectedListId === quickList?.id ? 'quick' : 'main';

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'category' | 'alphabetical' | 'recent' | 'oldest' | 'resident'>('category');
  const [emptyMessage, setEmptyMessage] = useState(EMPTY_MESSAGES[0]);

  const getMarketSessions = () => JSON.parse(localStorage.getItem('carrin_market_sessions_v1') || '{}');
  const saveMarketSession = (listId: string, active: boolean) => {
    const sessions = getMarketSessions();
    if (active) sessions[listId] = { active: true };
    else delete sessions[listId];
    localStorage.setItem('carrin_market_sessions_v1', JSON.stringify(sessions));
    setIsMarketMode(active);
  };
  const [isMarketMode, setIsMarketMode] = useState(false);
  
  const currentListHasMarketSession = selectedListId ? !!getMarketSessions()[selectedListId]?.active : false;
  
  const [syncStatus, setSyncStatus] = useState<'Salvando...' | 'Salvo ✓' | 'Sem conexão • pendente' | null>(null);
  const [showFabTooltip, setShowFabTooltip] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  
  const [priceModalItem, setPriceModalItem] = useState<any | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [boughtQty, setBoughtQty] = useState<number>(1);

  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [itemToUncheck, setItemToUncheck] = useState<any | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [pendingListSwitch, setPendingListSwitch] = useState<string | null>(null);
  const [homePreferences, setHomePreferences] = useState<Record<string, string>>({});
  
  const [userPrefs, setUserPrefs] = useState<any>(null);

  const [showListSwitcherMenu, setShowListSwitcherMenu] = useState(false); 
  const [showListActionsMenu, setShowListActionsMenu] = useState(false); 
  
  const [showQuickIntro, setShowQuickIntro] = useState(false);
  const [showCreateQuick, setShowCreateQuick] = useState(false);
  const [showRenameQuick, setShowRenameQuick] = useState(false);
  const [showDeleteQuick, setShowDeleteQuick] = useState(false);
  const [quickListNameInput, setQuickListNameInput] = useState('');
  const [listActionLoading, setListActionLoading] = useState(false);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearingList, setClearingList] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [undoDelete, setUndoDelete] = useState<{ item: any, timerId: ReturnType<typeof setTimeout> } | null>(null);
  const [undoClear, setUndoClear] = useState<{ items: any[], listId: string, timerId: ReturnType<typeof setTimeout> } | null>(null);

  const [commercialContext, setCommercialContext] = useState<any>(null);
  const [canWrite, setCanWrite] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [pushPromptResolved, setPushPromptResolved] = useState(() => {
    if (!('Notification' in window)) return true;
    if (Notification.permission !== 'default') return true;
    if (localStorage.getItem('carrin_push_prompt_seen')) return true;
    return false;
  });

  const isAnyModalOpen = !!(priceModalItem || itemToUncheck || showTutorial || isFinishModalOpen || isModalOpen || showPushPrompt || showClearConfirm || showQuickIntro || showCreateQuick || showRenameQuick || showDeleteQuick);

  useScrollLock(isAnyModalOpen);

  useEffect(() => {
    async function loadPrefs() {
      if (!user?.id) return;
      const prefs = await preferenceService.getPreferences(user.id);
      setUserPrefs(prefs);
    }
    loadPrefs();
  }, [user?.id]);

  const checkAccess = useCallback(async () => {
    if (!homeId || !user) return;
    try {
      const { data, error } = await supabase.rpc('get_commercial_context', { p_home_id: homeId });
      if (!error && data) {
        setCommercialContext(data);
        setCanWrite(data.can_write);
      }
    } catch (e) {
      console.error("Erro ao checar acesso:", e);
    }
  }, [homeId, user]);

  useEffect(() => {
    async function loadData() {
      if (!homeId || !user) return;
      try {
        setHasError(false);
        const mId = await itemService.getActiveMainListId(homeId);
        if (!mId) throw new Error('getActiveMainListId retornou null. Lista principal não resolvida.');
        
        setMainListId(mId);
        
        const qList = await itemService.getActiveQuickList(homeId);
        setQuickList(qList);
        
        if (!selectedListId) {
          setSelectedListId(mId);
          setIsMarketMode(!!getMarketSessions()[mId]?.active);
        }

        const prefs = await preferenceService.getHomeCategoryPreferences(homeId);
        setHomePreferences(prefs);
        const { data: memberRes } = await supabase.from('home_members').select('role').eq('home_id', homeId).eq('user_id', user.id).single();
        if (memberRes) setUserRole(memberRes.role);
        await checkAccess();
        
      } catch (error) {
        console.error("[Carrin/Init] Falha no fluxo inicial:", error);
        setHasError(true);
        setToastMsg('Erro crítico ao carregar lista.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [homeId, user, checkAccess]);

  useEffect(() => {
    if (!selectedListId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    setIsMarketMode(!!getMarketSessions()[selectedListId]?.active);

    itemService.getItems(selectedListId)
      .then(data => setItems(data))
      .catch(e => console.error("Erro ao buscar itens atualizados:", e))
      .finally(() => setLoading(false));

    const itemsChannel = supabase.channel(`items_${selectedListId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items', filter: `shopping_list_id=eq.${selectedListId}` }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const { data } = await supabase.from('shopping_items').select('*, users(username, full_name, avatar_url)').eq('id', payload.new.id).maybeSingle();
          const itemToInsert = data || payload.new;
          setItems(curr => curr.some(i => i.id === itemToInsert.id) ? curr : [itemToInsert, ...curr]);
        }
        else if (payload.eventType === 'UPDATE') {
          setItems(curr => curr.map(i => i.id === payload.new.id ? { ...i, ...payload.new } : i));
        }
        else if (payload.eventType === 'DELETE') {
          setItems(curr => curr.filter(i => i.id !== payload.old.id));
        }
      }).subscribe();

    return () => { supabase.removeChannel(itemsChannel); };
  }, [selectedListId]);

  useEffect(() => {
    if (!homeId) return;
    const listsChannel = supabase.channel(`lists_${homeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_lists', filter: `home_id=eq.${homeId}` }, async (payload) => {
        
        if (payload.eventType === 'UPDATE' && payload.new.id === selectedListId && payload.new.status === 'completed') {
          setToastMsg('Esta lista foi finalizada por outro morador.');
          setTimeout(() => setToastMsg(null), 4000);
          setIsMarketMode(false);
          saveMarketSession(selectedListId!, false);
          
          if (payload.new.list_type === 'main') {
            const newMainId = await itemService.getActiveMainListId(homeId);
            if (newMainId) {
              setMainListId(newMainId);
              setSelectedListId(newMainId);
            }
          } else {
            setQuickList(null);
            setSelectedListId(mainListId);
          }
          return;
        }

        if (payload.eventType === 'INSERT' && payload.new.list_type === 'quick') {
          setQuickList({ id: payload.new.id, name: payload.new.name });
        } 
        else if (payload.eventType === 'UPDATE' && payload.new.list_type === 'quick') {
          if (payload.new.status === 'active') {
            setQuickList({ id: payload.new.id, name: payload.new.name });
          } else {
            setQuickList(null);
            if (selectedListId === payload.new.id) {
              setToastMsg(payload.new.status === 'deleted' ? 'A Lista Rápida foi excluída.' : 'A Lista Rápida foi finalizada.');
              setTimeout(() => setToastMsg(null), 4000);
              setSelectedListId(mainListId);
            }
          }
        }
      }).subscribe();
    return () => { supabase.removeChannel(listsChannel); };
  }, [homeId, selectedListId, mainListId]);

  useEffect(() => {
    if (!homeId) return;
    const channel = supabase
      .channel(`commercial_status_${homeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'house_commercial_states', filter: `home_id=eq.${homeId}` }, () => checkAccess())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [homeId, checkAccess]);

  useEffect(() => { localStorage.setItem('carrin_current_tab', currentTab); }, [currentTab]);

  useEffect(() => {
    if (isMarketMode) {
      setShowFabTooltip(true);
      const timer = setTimeout(() => setShowFabTooltip(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setShowFabTooltip(false);
      setShowListActionsMenu(false); 
      setShowListSwitcherMenu(false);
    }
  }, [isMarketMode]);

  useEffect(() => {
    if (items.length === 0 && !loading) setEmptyMessage(EMPTY_MESSAGES[Math.floor(Math.random() * EMPTY_MESSAGES.length)]);
  }, [items.length, loading]);

  useEffect(() => {
    if (!pushPromptResolved) {
      const timer = setTimeout(() => setShowPushPrompt(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [pushPromptResolved]);

  const handleEnablePush = async () => {
    if (user) {
      const success = await notificationService.subscribeToPushNotifications();
      if (success) { localStorage.setItem('carrin_push_prompt_seen', 'true'); setPushPromptResolved(true); }
      return success;
    }
    return false;
  };

  const handleDeclinePush = () => {
    localStorage.setItem('carrin_push_prompt_seen', 'true');
    setShowPushPrompt(false);
    setPushPromptResolved(true);
  };

  const handleStartQuickListCreation = () => {
    setShowListSwitcherMenu(false);
    if (userPrefs?.tutorial_state?.quick_list_intro !== 'done') setShowQuickIntro(true);
    else { setQuickListNameInput(''); setShowCreateQuick(true); }
  };

  const handleConfirmQuickIntro = async () => {
    if (user) {
      await preferenceService.markTutorialAsDone(user.id, 'quick_list_intro');
      setUserPrefs((prev: any) => ({ ...prev, tutorial_state: { ...prev.tutorial_state, quick_list_intro: 'done' }}));
    }
    setShowQuickIntro(false);
    setQuickListNameInput('');
    setShowCreateQuick(true);
  };

  const handleCreateQuickList = async () => {
    if (!homeId || listActionLoading) return;
    setListActionLoading(true);
    const finalName = quickListNameInput.trim() || 'Lista Rápida';
    try {
      const id = await itemService.createQuickList(homeId, finalName);
      setQuickList({ id, name: finalName });
      setSelectedListId(id);
      setShowCreateQuick(false);
    } catch (error: any) {
      if (error.code === '23505') {
        const existing = await itemService.getActiveQuickList(homeId);
        if (existing) { setQuickList(existing); setSelectedListId(existing.id); setShowCreateQuick(false); }
      } else alert("Erro ao criar lista rápida. Tente novamente.");
    } finally { setListActionLoading(false); }
  };

  const handleRenameQuickList = async () => {
    if (!quickList || listActionLoading) return;
    setListActionLoading(true);
    const finalName = quickListNameInput.trim() || 'Lista Rápida';
    try {
      await itemService.renameQuickList(quickList.id, finalName);
      setQuickList({ ...quickList, name: finalName });
      setShowRenameQuick(false);
    } catch (e) { alert("Erro ao renomear lista."); } 
    finally { setListActionLoading(false); }
  };

  const handleDeleteQuickList = async () => {
    if (!quickList || listActionLoading) return;
    setListActionLoading(true);
    try {
      await itemService.deleteQuickList(quickList.id);
      saveMarketSession(quickList.id, false); 
      setQuickList(null);
      setSelectedListId(mainListId);
      setShowDeleteQuick(false);
    } catch (e) { alert("Erro ao excluir. Verifique se você é Administrador."); } 
    finally { setListActionLoading(false); }
  };

  const handleToggleMarketMode = () => {
    if (!isMarketMode) {
      const seenTutorial = localStorage.getItem('carrin_market_tutorial_seen');
      if (!seenTutorial) { setShowTutorial(true); return; }
      saveMarketSession(selectedListId!, true);
    } else saveMarketSession(selectedListId!, false);
  };

  const handleCancelMarketSession = () => {
    const sessions = getMarketSessions();
    const targetId = (quickList?.id && sessions[quickList.id]?.active) ? quickList.id : mainListId;
    if (targetId) saveMarketSession(targetId, false);
  };

  const confirmTutorialAndEnter = () => {
    localStorage.setItem('carrin_market_tutorial_seen', 'true');
    setShowTutorial(false);
    saveMarketSession(selectedListId!, true);
  };

  const handleEditPrice = (item: any) => {
    setPriceModalItem(item);
    setBoughtQty(item.bought_quantity || (item.quantity ? Number(item.quantity) : 1));
    if (item.unit_price) { 
      setPriceInput(Number(item.unit_price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })); 
    } else if (item.price) {
      const fallbackUnit = Number(item.price) / (item.bought_quantity || 1);
      setPriceInput(fallbackUnit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    } else { 
      setPriceInput(''); 
    }
  };

  const handleToggle = async (item: any) => {
    const nextStatus = !item.is_completed;
    if (isMarketMode && nextStatus) {
      handleEditPrice(item);
      return;
    }
    if (!nextStatus && item.price > 0) {
      setItemToUncheck(item);
      return;
    }
    executeToggle(item.id, nextStatus, nextStatus ? item.price : 0, nextStatus ? item.unit_price : null, nextStatus ? item.bought_quantity : null);
  };

  const handleConfirmUncheck = () => {
    if (!itemToUncheck) return;
    executeToggle(itemToUncheck.id, false, 0, null, null);
    setItemToUncheck(null);
  };

  const executeToggle = async (itemId: string, isCompleted: boolean, price?: number | null, unitPrice?: number | null, boughtQuantity?: number | null) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, is_completed: isCompleted, price: price !== undefined ? price : i.price, unit_price: unitPrice !== undefined ? unitPrice : i.unit_price, bought_quantity: boughtQuantity !== undefined ? boughtQuantity : i.bought_quantity } : i));
    
    if (isMarketMode) setSyncStatus('Salvando...');
    try {
      await itemService.toggleItemCompletion(itemId, isCompleted, price || 0, unitPrice || 0, boughtQuantity || 0);
      if (isMarketMode) { setSyncStatus('Salvo ✓'); setTimeout(() => setSyncStatus(null), 2500); }
    } catch (error) {
      console.error("Erro ao atualizar item:", error);
      if (isMarketMode) setSyncStatus('Sem conexão • pendente');
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); 
    if (value === '') { setPriceInput(''); return; }
    const numberValue = parseInt(value, 10) / 100;
    setPriceInput(numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  const handleSavePriceModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceModalItem) return;
    const parsedUnitPrice = priceInput.trim() !== '' ? parseFloat(priceInput.replace(/\./g, '').replace(',', '.')) : 0;
    const computedTotal = parsedUnitPrice * boughtQty;
    await executeToggle(priceModalItem.id, true, computedTotal, parsedUnitPrice, boughtQty);
    setPriceModalItem(null);
    setPriceInput('');
  };

  const handleUpdateCategory = async (itemId: string, newCategoryId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item || !homeId || !user) return;
    
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, category_id: newCategoryId } : i));
    
    if (isMarketMode) setSyncStatus('Salvando...');
    try {
      await itemService.updateItem(itemId, { category_id: newCategoryId });
      const normalizedName = item.name.trim().toLowerCase().replace(/\s+/g, ' ');
      await preferenceService.saveHomeCategoryPreference(homeId, normalizedName, newCategoryId, user.id);
      if (isMarketMode) { setSyncStatus('Salvo ✓'); setTimeout(() => setSyncStatus(null), 2500); }
    } catch (error) {
      if (isMarketMode) setSyncStatus('Sem conexão • pendente');
    }
  };

  const handleDelete = async (id: string) => {
    const itemToDelete = items.find(i => i.id === id);
    if (!itemToDelete) return;
    
    const previousItems = [...items];
    
    setItems(prev => prev.filter(item => item.id !== id));
    
    try {
      await itemService.deleteItem(id);
      if (undoDelete?.timerId) clearTimeout(undoDelete.timerId);
      const timerId = setTimeout(() => setUndoDelete(null), 5000);
      setUndoDelete({ item: itemToDelete, timerId });

      if (homeId) {
        try { await supabase.rpc('notify_items_removed', { p_count: 1, p_home_id: homeId, p_item_name: itemToDelete.name, p_shopping_list_id: selectedListId }); } 
        catch (notifyError) { console.error('ITEM_REMOVED_NOTIFICATION_ERROR:', notifyError); }
      }
    } catch (error) {
      console.error("Erro ao deletar item:", error);
      setItems(previousItems);
      alert("Erro ao excluir o item. Verifique sua conexão.");
    }
  };

  const handleUndoDelete = async () => {
    if (!undoDelete || !homeId || !user) return;
    clearTimeout(undoDelete.timerId);
    const item = undoDelete.item;
    setUndoDelete(null);
    try {
      const savedItem = await itemService.addItem({ 
        name: item.name, quantity: item.quantity, unit: item.unit, observation: item.observation, 
        category_id: item.category_id || '🛒 Mantimentos', home_id: homeId, shopping_list_id: item.shopping_list_id || selectedListId, created_by: item.created_by 
      });
      if (savedItem && selectedListId === (item.shopping_list_id || selectedListId)) { 
        setItems(prev => [savedItem, ...prev.filter(i => i.id !== savedItem.id)]); 
      }
      setToastMsg('Item restaurado');
      setTimeout(() => setToastMsg(null), 3000);
    } catch (error) { console.error("Erro ao desfazer exclusão:", error); }
  };

  const handleClearList = async () => {
    if (!selectedListId || clearingList) return;
    const snapshot = [...items];
    setClearingList(true);
    
    try {
      await itemService.clearList(selectedListId);
      setItems([]);
      
      if (undoClear?.timerId) clearTimeout(undoClear.timerId);
      const timerId = setTimeout(() => setUndoClear(null), 5000);
      setUndoClear({ items: snapshot, listId: selectedListId, timerId });

      if (homeId && snapshot.length > 0) {
        try { await supabase.rpc('notify_items_removed', { p_count: snapshot.length, p_home_id: homeId, p_item_name: null, p_shopping_list_id: selectedListId }); } 
        catch (notifyError) { console.error('ITEM_REMOVED_NOTIFICATION_ERROR:', notifyError); }
      }
    } catch (error) {
      console.error("Erro ao limpar a lista:", error);
      alert("Houve um erro ao limpar a lista. Verifique sua conexão.");
      setItems(snapshot);
    } finally {
      setClearingList(false);
      setShowClearConfirm(false);
      setShowListActionsMenu(false);
    }
  };

  const handleUndoClear = async () => {
    if (!undoClear || !homeId || !user) return;
    clearTimeout(undoClear.timerId);
    const { items: snapshot, listId } = undoClear;
    setUndoClear(null);
    setToastMsg('Restaurando itens...');
    try {
      const currentActive = await itemService.getItems(listId);
      const currentNames = currentActive.map(i => normalizeStr(i.name));
      const itemsToAdd = snapshot.filter(item => !currentNames.includes(normalizeStr(item.name)));
      
      const restoredItems = await Promise.all(itemsToAdd.map(item => 
        itemService.addItem({ 
          name: item.name, quantity: item.quantity, unit: item.unit, observation: item.observation, 
          category_id: item.category_id || '🛒 Mantimentos', home_id: homeId, shopping_list_id: listId, created_by: item.created_by 
        })
      ));
      
      if (selectedListId === listId) {
        setItems(prev => {
          const validRestored = restoredItems.filter(Boolean);
          const restoredIds = validRestored.map(i => i.id);
          return [...validRestored, ...prev.filter(i => !restoredIds.includes(i.id))];
        });
      }
      setToastMsg('Lista restaurada ✓');
      setTimeout(() => setToastMsg(null), 3000);
    } catch (error) {
      console.error("Erro ao restaurar a lista:", error);
      setToastMsg('Erro ao restaurar');
      setTimeout(() => setToastMsg(null), 3000);
    }
  };

  const handleSaveItem = async (name: string, quantity: number | null, unit: string | null, observation: string, categoryId: string) => {
    if (!homeId || !user) return;

    if (!selectedListId) {
      setToastMsg('Erro crítico: Lista não encontrada.');
      throw new Error("Lista principal não resolvida."); 
    }

    const formattedData = { name: name.trim(), quantity: quantity, unit: unit, observation: observation ? observation.trim() : undefined, category_id: categoryId || '🛒 Mantimentos' };
    
    try {
      if (editingItem) {
        if (isMarketMode) setSyncStatus('Salvando...');
        await itemService.updateItem(editingItem.id, formattedData);
        setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...formattedData } : i));
        if (isMarketMode) { setSyncStatus('Salvo ✓'); setTimeout(() => setSyncStatus(null), 2500); }
      } else {
        const newItem = { ...formattedData, home_id: homeId, shopping_list_id: selectedListId, created_by: user.id };
        const savedItem = await itemService.addItem(newItem as any);
        if (savedItem) { 
          setItems(prev => [savedItem, ...prev.filter(i => i.id !== savedItem.id)]); 
        }
      }
    } catch (err) {
      console.error("Erro ao salvar item:", err);
      setToastMsg('Falha ao salvar o item.');
      setTimeout(() => setToastMsg(null), 3000);
      if (isMarketMode) setSyncStatus('Sem conexão • pendente');
      throw err; 
    }
  };

  const handleOpenFinishModal = () => {
    if (!homeId || !selectedListId) return;
    setIsFinishModalOpen(true);
  };

  const handleConfirmFinishShopping = async (receiptUrls: string[], marketName?: string, paymentMethods?: any[] | null) => {
    if (!homeId || !selectedListId || finishing) return;
    setFinishing(true);
    try {
      const newListId = await historyService.finishActiveList(homeId, selectedListId, totalEstimated, receiptUrls, marketName, paymentMethods);
      saveMarketSession(selectedListId, false);
      
      if (selectedListType === 'main' && newListId) {
        setPendingListSwitch(newListId);
      } else {
        setPendingListSwitch('quick_to_main');
      }
    } catch (error) {
      console.error("Erro ao finalizar compra:", error);
      alert("Houve um erro ao salvar o histórico. Tente novamente.");
      throw error;
    } finally {
      setFinishing(false);
    }
  };

  const handleCloseFinishModal = () => {
    setIsFinishModalOpen(false);
    setIsMarketMode(false);
    setItems([]);

    if (pendingListSwitch === 'quick_to_main') {
      setQuickList(null);
      setSelectedListId(mainListId);
    } else if (pendingListSwitch) {
      setMainListId(pendingListSwitch);
      setSelectedListId(pendingListSwitch);
    }
    setPendingListSwitch(null);
  };

  const openAddModal = () => { setEditingItem(null); setIsModalOpen(true); };
  const openEditModal = (item: any) => { setEditingItem(item); setIsModalOpen(true); };

  const realPendingCount = items.filter(item => !item.is_completed).length;
  const totalEstimated = items.reduce((sum, item) => { return sum + (item.is_completed && item.price ? Number(item.price) : 0); }, 0);
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
              <h2 className={`font-bold text-gray-500 uppercase tracking-wider mb-3 ${isMarketMode ? 'text-base text-emerald-800' : 'text-sm'}`}>{category}</h2>
              <div className="space-y-2">
                {groupedPending[category].map((item: any) => (
                  <div key={item.id} className={isMarketMode ? 'py-1 text-lg' : ''}>
                    <ShoppingItemCard name={item.name} quantity={item.quantity ? `${item.quantity} ${item.unit || ''}`.trim() : undefined} observation={item.observation} isCompleted={item.is_completed} isMarketMode={isMarketMode} creatorAvatar={item.users?.avatar_url} creatorName={item.users?.full_name || item.users?.username} price={item.price} unitPrice={item.unit_price} boughtQuantity={item.bought_quantity} onToggle={() => handleToggle(item)} onDelete={() => handleDelete(item.id)} onEdit={() => openEditModal(item)} onEditPrice={() => handleEditPrice(item)} onUpdateCategory={(cat) => handleUpdateCategory(item.id, cat)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (sortBy === 'resident') {
      const groupedPending = pendingItems.reduce((acc: any, item: any) => {
        const u = item.users;
        const rawName = u?.full_name?.split(' ')[0] || u?.username?.replace('@', '') || 'Morador';
        const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        const avatar = u?.avatar_url || null;
        if (!acc[name]) acc[name] = { items: [], avatar, name };
        acc[name].items.push(item);
        return acc;
      }, {});
      const sortedResidents = Object.keys(groupedPending).sort();

      return (
        <div className="mb-6 space-y-6">
          {sortedResidents.map((residentName) => {
            const group = groupedPending[residentName];
            const sortedItems = group.items.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            return (
              <div key={residentName}>
                <div className="flex items-center gap-2 mb-3">
                  {group.avatar ? ( <img src={group.avatar} className="w-5 h-5 rounded-full object-cover border border-gray-200" alt={group.name} /> ) : ( <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-gray-500"><User size={12} /></div> )}
                  <h2 className={`font-bold text-gray-500 uppercase tracking-wider ${isMarketMode ? 'text-base text-emerald-800' : 'text-sm'}`}>{group.name}</h2>
                </div>
                <div className="space-y-2">
                  {sortedItems.map((item: any) => (
                    <div key={item.id} className={isMarketMode ? 'py-1 text-lg' : ''}>
                      <ShoppingItemCard name={item.name} quantity={item.quantity ? `${item.quantity} ${item.unit || ''}`.trim() : undefined} observation={item.observation} isCompleted={item.is_completed} isMarketMode={isMarketMode} creatorAvatar={item.users?.avatar_url} creatorName={item.users?.full_name || item.users?.username} price={item.price} unitPrice={item.unit_price} boughtQuantity={item.bought_quantity} onToggle={() => handleToggle(item)} onDelete={() => handleDelete(item.id)} onEdit={() => openEditModal(item)} onEditPrice={() => handleEditPrice(item)} onUpdateCategory={(cat) => handleUpdateCategory(item.id, cat)} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    const flatSorted = [...pendingItems].sort((a, b) => {
      if (sortBy === 'alphabetical') { return a.name.localeCompare(b.name); } 
      else if (sortBy === 'recent') { return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); } 
      else if (sortBy === 'oldest') { return new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); }
      return 0;
    });

    return (
      <div className="mb-6 space-y-2">
        {flatSorted.map((item: any) => (
          <div key={item.id} className={isMarketMode ? 'py-1 text-lg' : ''}>
            <ShoppingItemCard name={item.name} quantity={item.quantity ? `${item.quantity} ${item.unit || ''}`.trim() : undefined} observation={item.observation} isCompleted={item.is_completed} isMarketMode={isMarketMode} creatorAvatar={item.users?.avatar_url} creatorName={item.users?.full_name || item.users?.username} price={item.price} unitPrice={item.unit_price} boughtQuantity={item.bought_quantity} onToggle={() => handleToggle(item)} onDelete={() => handleDelete(item.id)} onEdit={() => openEditModal(item)} onEditPrice={() => handleEditPrice(item)} onUpdateCategory={(cat) => handleUpdateCategory(item.id, cat)} />
          </div>
        ))}
      </div>
    );
  };

  const billingUI = interpretBillingState(commercialContext, userRole);

  return (
    <div className="w-full min-h-[100dvh] bg-carrin-bg relative overflow-x-hidden">
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-[#059669] text-white px-5 py-2.5 rounded-full flex items-center gap-4 shadow-lg z-[9999] w-max max-w-[90vw] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2"><Check size={18} strokeWidth={2.5} /><span className="font-semibold text-sm truncate">{toastMsg}</span></div>
          <button onClick={() => setToastMsg(null)} className="opacity-80 hover:opacity-100 flex-shrink-0 flex items-center" type="button"><X size={16} strokeWidth={2.5} /></button>
        </div>
      )}

      {undoDelete && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-carrin-dark text-white px-5 py-3 rounded-full flex items-center gap-4 shadow-2xl z-[9999] w-max max-w-[90vw] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="font-semibold text-sm">Item removido</span><div className="w-px h-4 bg-gray-600"></div>
          <button onClick={handleUndoDelete} className="text-emerald-400 hover:text-emerald-300 font-bold text-sm flex items-center gap-1.5 transition-colors"><RotateCcw size={14} /> Desfazer</button>
        </div>
      )}

      {undoClear && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-carrin-dark text-white px-5 py-3 rounded-full flex items-center gap-4 shadow-2xl z-[9999] w-max max-w-[90vw] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="font-semibold text-sm">Lista limpa</span><div className="w-px h-4 bg-gray-600"></div>
          <button onClick={handleUndoClear} className="text-emerald-400 hover:text-emerald-300 font-bold text-sm flex items-center gap-1.5 transition-colors"><RotateCcw size={14} /> Desfazer</button>
        </div>
      )}

      <div className={`w-full min-h-[100dvh] bg-carrin-bg ${isMarketMode ? 'pb-[calc(6rem+env(safe-area-inset-bottom))]' : 'pb-[calc(8rem+env(safe-area-inset-bottom))]'} ${currentTab === 'list' ? 'block' : 'hidden'}`}>
        
        {!isMarketMode && currentListHasMarketSession && (
          <div className="bg-emerald-800 text-white px-4 py-2.5 text-xs flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2"><AlertCircle size={16} className="text-emerald-300 animate-pulse" /><span className="font-semibold">Modo Mercado em andamento</span></div>
            <div className="flex items-center gap-2">
              <button onClick={handleCancelMarketSession} className="bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-100 px-3 py-1 rounded-small font-bold text-xs flex items-center gap-1 transition-all" title="Encerrar Sessão"><X size={12} strokeWidth={3} /><span>Encerrar</span></button>
              <button onClick={() => {
                const sessions = getMarketSessions();
                const targetId = (quickList?.id && sessions[quickList.id]?.active) ? quickList.id : mainListId;
                if (targetId) {
                  setSelectedListId(targetId);
                  setIsMarketMode(true);
                }
              }} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-small font-bold text-xs flex items-center gap-1 shadow transition-all"><Play size={12} fill="white" /><span>Retomar</span></button>
            </div>
          </div>
        )}

        <div className="p-6 pb-2">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 relative">
              <div className="flex items-center gap-1 mb-0.5">
                {selectedListType === 'quick' && (
                  <button onClick={() => setSelectedListId(mainListId)} className="mr-1 p-1 text-gray-400 hover:text-carrin-dark rounded-full transition-colors"><ChevronLeft size={22} /></button>
                )}
                <h1 className="text-2xl font-bold text-carrin-dark truncate max-w-[200px]">
                  {selectedListType === 'quick' ? (quickList?.name || 'Lista Rápida') : 'Sua Lista'}
                </h1>
                
                <button onClick={() => { setShowListSwitcherMenu(!showListSwitcherMenu); setShowListActionsMenu(false); }} className="ml-1 p-1 text-gray-400 hover:text-carrin-dark rounded-full hover:bg-gray-100 transition-colors shrink-0">
                  <MoreVertical size={20} />
                </button>

                {showListSwitcherMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowListSwitcherMenu(false)} />
                    <div className="absolute left-0 top-[36px] w-56 bg-white rounded-card shadow-xl border border-gray-100 z-50 py-1 animate-in fade-in slide-in-from-top-2">
                      {selectedListType === 'main' ? (
                        <>
                          {!quickList ? (
                            <button onClick={handleStartQuickListCreation} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2"><PlusCircle size={16}/> Criar lista rápida</button>
                          ) : (
                            <button onClick={() => { setSelectedListId(quickList.id); setShowListSwitcherMenu(false); }} className="w-full text-left px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"><ShoppingCart size={16}/> Abrir "{quickList.name || 'Lista Rápida'}"</button>
                          )}
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setSelectedListId(mainListId); setShowListSwitcherMenu(false); }} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2"><ChevronLeft size={16}/> Voltar para Sua Lista</button>
                          <button onClick={() => { setShowListSwitcherMenu(false); setQuickListNameInput(quickList?.name || ''); setShowRenameQuick(true); }} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2"><Edit2 size={16}/> Renomear lista rápida</button>
                          {(userRole === 'owner' || userRole === 'admin') && (
                            <>
                              <div className="h-px bg-gray-100 my-1" />
                              <button onClick={() => { setShowListSwitcherMenu(false); setShowDeleteQuick(true); }} className="w-full text-left px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 bg-red-50/50"><AlertCircle size={16}/> Excluir lista rápida</button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
              <p className="text-gray-500 text-sm">{isMarketMode ? 'Executando compras no corredor' : (selectedListType === 'quick' ? 'Lista rápida da Casa' : 'Compras da Casa')}</p>
            </div>

            <div className="flex items-center gap-3">
              <NotificationBell />
              <button onClick={handleToggleMarketMode} className={`px-3.5 py-2.5 rounded-small text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${isMarketMode ? 'bg-emerald-600 text-white ring-2 ring-emerald-300' : 'bg-white text-carrin-dark border border-gray-200 hover:border-carrin-primary'}`}><ShoppingCart size={16} /><span>{isMarketMode ? 'Sair do Modo Mercado' : 'Modo Mercado'}</span></button>
            </div>
          </div>
          
          {isMarketMode ? (
            <div className="bg-emerald-900 text-white p-4 rounded-card mb-6 flex justify-between items-center shadow-md animate-in fade-in duration-200">
              <div>
                <p className="text-xs text-emerald-300 flex items-center gap-2">Falta no Carrinho{syncStatus && (<span className={`text-[9px] px-1.5 py-0.5 rounded opacity-90 transition-colors ${syncStatus.includes('Erro') || syncStatus.includes('Sem conexão') ? 'bg-red-500/20 text-red-200' : 'bg-emerald-800 text-emerald-100'}`}>{syncStatus}</span>)}</p>
                <p className="text-2xl font-extrabold">{realPendingCount}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-emerald-300">Total Atual</p>
                <p className="text-2xl font-extrabold text-emerald-300 flex items-center justify-center gap-1"><span className="text-sm font-bold opacity-80">R$</span>{totalEstimated.toFixed(2)}</p>
              </div>
              {items.length > 0 && (<button onClick={handleOpenFinishModal} disabled={finishing} className="bg-carrin-primary text-white text-xs px-3 py-2 rounded-small font-semibold flex items-center gap-1 hover:opacity-90 transition-all disabled:opacity-50 shadow" title="Finalizar compra e arquivar lista"><CheckCheck size={16} /><span>{finishing ? 'Finalizando...' : 'Finalizar'}</span></button>)}
            </div>
          ) : (
            <div className="bg-carrin-dark text-white p-4 rounded-card mb-6 flex justify-between items-center shadow-sm">
              <div><p className="text-xs text-gray-400">Total de itens</p><p className="text-xl font-bold">{items.length}</p></div>
              <div className="text-right"><p className="text-xs text-gray-400">Pendentes</p><p className="text-xl font-bold">{realPendingCount}</p></div>
            </div>
          )}

          {items.length > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                <input type="text" placeholder="Pesquisar item..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-100 rounded-small text-sm focus:outline-none focus:border-emerald-600 transition-colors shadow-sm" />
              </div>
              <div className="relative shrink-0">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="appearance-none bg-white border border-gray-100 rounded-small pl-9 pr-8 py-2.5 text-sm text-carrin-dark font-semibold focus:outline-none focus:border-emerald-600 transition-colors cursor-pointer shadow-sm">
                  <option value="category">Categorias</option><option value="recent">Mais recentes</option><option value="oldest">Mais antigos</option><option value="alphabetical">Alfabética</option><option value="resident">Morador</option>
                </select>
                <ListFilter size={14} className="absolute left-3 top-3.5 text-emerald-600 pointer-events-none" />
              </div>
              
              {!isMarketMode && (
                <div className="relative shrink-0">
                  <button onClick={() => { setShowListActionsMenu(!showListActionsMenu); setShowListSwitcherMenu(false); }} className="w-[42px] h-[42px] flex items-center justify-center bg-white border border-gray-100 rounded-small text-gray-500 hover:text-carrin-dark hover:border-carrin-primary transition-colors shadow-sm"><MoreVertical size={20} /></button>
                  {showListActionsMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowListActionsMenu(false)} />
                      <div className="absolute right-0 top-[50px] mt-1 w-44 bg-white rounded-card shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <button onClick={() => { setShowListActionsMenu(false); setShowClearConfirm(true); }} className="w-full text-left px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors">Limpar lista</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6">
          {loading ? (
            <p className="text-center text-gray-400 py-10">Carregando itens...</p>
          ) : hasError ? (
            <div className="text-center py-12 bg-white rounded-card shadow-sm p-6">
              <AlertCircle size={32} className="mx-auto text-red-500 mb-3" />
              <p className="text-carrin-dark mb-2 font-bold text-sm">Falha ao carregar a lista.</p>
              <p className="text-xs text-gray-500 mb-4">Ocorreu um erro no banco de dados.</p>
              <button onClick={() => window.location.reload()} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-small font-bold text-xs hover:bg-gray-200">
                Tentar Novamente
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-card shadow-sm p-6 animate-in fade-in zoom-in duration-300">
              <p className="text-gray-400 mb-2 font-bold text-sm">{selectedListType === 'quick' ? 'Sua Lista Rápida está vazia.' : 'Sua lista está vazia.'}</p>
              <p className="text-xs text-gray-400">{selectedListType === 'quick' ? 'Adicione itens para começar o churrasco.' : emptyMessage}</p>
            </div>
          ) : searchedItems.length === 0 ? (
            <div className="text-center py-10"><p className="text-gray-400 text-sm">Nenhum item encontrado para "{searchQuery}".</p></div>
          ) : (
            <>
              {renderPendingItems()}
              {completedItems.length > 0 && (
                <div className="mt-8 pt-4 border-t border-gray-200">
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center justify-between"><span>Comprados ({completedItems.length})</span></h2>
                  <div className="space-y-2">
                    {completedItems.map((item: any) => (
                      <div key={item.id} className="relative group">
                        <ShoppingItemCard name={item.name} quantity={item.quantity ? `${item.quantity} ${item.unit || ''}`.trim() : undefined} observation={item.observation} isCompleted={item.is_completed} isMarketMode={isMarketMode} creatorAvatar={item.users?.avatar_url} creatorName={item.users?.full_name || item.users?.username} price={item.price} unitPrice={item.unit_price} boughtQuantity={item.bought_quantity} onToggle={() => handleToggle(item)} onDelete={() => handleDelete(item.id)} onEdit={() => openEditModal(item)} onEditPrice={() => handleEditPrice(item)} onUpdateCategory={(cat) => handleUpdateCategory(item.id, cat)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {!isMarketMode && (
          <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 w-full px-6 pointer-events-none z-40">
            {canWrite ? (
              <button onClick={openAddModal} className="w-full bg-carrin-primary text-white py-4 rounded-button font-semibold shadow-sm pointer-events-auto hover:opacity-90 transition-all flex items-center justify-center gap-2">
                <span>+ Adicionar Item</span>
              </button>
            ) : (
              <div className="bg-white p-4 rounded-card shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] border border-red-200 pointer-events-auto flex flex-col items-center text-center gap-2 animate-in slide-in-from-bottom-4 mb-2">
                <div className="flex items-center gap-2 text-red-500 font-bold"><AlertCircle size={20} /><span>Acesso Suspenso</span></div>
                <p className="text-xs text-gray-500 font-medium leading-relaxed">{billingUI.blockMessage}</p>
                {userRole === 'owner' && (
                  <button onClick={() => setCurrentTab('settings')} className="w-full mt-2 bg-red-50 text-red-600 py-3 rounded-small font-bold text-sm hover:bg-red-100 transition-colors">
                    {billingUI.ctaText || 'Regularizar Assinatura'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {isMarketMode && canWrite && (
          <div className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
            {showFabTooltip && (
              <div className="bg-carrin-dark text-white text-xs font-bold px-3 py-2 rounded-xl shadow-xl relative animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-auto cursor-pointer" onClick={() => setShowFabTooltip(false)}>Faltou algo? Adicione aqui! 👀<div className="absolute -bottom-1.5 right-5 w-3 h-3 bg-carrin-dark rotate-45 rounded-sm"></div></div>
            )}
            <button onClick={openAddModal} className="w-14 h-14 bg-carrin-primary text-white rounded-full shadow-xl flex items-center justify-center hover:bg-emerald-600 hover:scale-105 active:scale-95 transition-all pointer-events-auto" title="Adicionar item esquecido"><Plus size={28} strokeWidth={2.5} /></button>
          </div>
        )}
      </div>

      <div className={currentTab === 'history' ? 'block' : 'hidden'}><History isActive={currentTab === 'history'} /></div>
      <div className={currentTab === 'home' ? 'block' : 'hidden'}><Home /></div>
      <div className={currentTab === 'settings' ? 'block' : 'hidden'}><Settings /></div>

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-red-600 mb-3"><AlertCircle size={28} /><h3 className="text-xl font-extrabold text-carrin-dark">Limpar toda a lista?</h3></div>
            <p className="text-sm text-gray-600 mb-6">Os <strong>{items.length}</strong> itens da lista atual serão removidos. Essa ação não afeta suas compras já finalizadas nem o Histórico.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowClearConfirm(false)} disabled={clearingList} className="w-1/2 bg-gray-100 text-gray-600 py-3.5 rounded-button font-bold text-sm hover:bg-gray-200 transition-colors disabled:opacity-50">Cancelar</button>
              <button onClick={handleClearList} disabled={clearingList} className="w-full bg-red-600 text-white py-3.5 rounded-button font-bold text-sm shadow hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">{clearingList ? 'Limpando...' : 'Limpar lista'}</button>
            </div>
          </div>
        </div>
      )}

      {itemToUncheck && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-emerald-600 mb-3"><AlertCircle size={28} /><h3 className="text-xl font-extrabold text-carrin-dark">Desmarcar Item?</h3></div>
            <p className="text-sm text-gray-600 mb-6">O item <strong>{itemToUncheck.name}</strong> já possui o valor de <strong className="text-emerald-600">R$ {Number(itemToUncheck.price).toFixed(2)}</strong>. Ao desmarcar, esse valor será zerado.</p>
            <div className="flex gap-2">
              <button onClick={() => setItemToUncheck(null)} className="w-1/2 bg-gray-100 text-gray-600 py-3.5 rounded-button font-bold text-sm hover:bg-gray-200 transition-colors">Cancelar</button>
              <button onClick={handleConfirmUncheck} className="w-full bg-emerald-600 text-white py-3.5 rounded-button font-bold text-sm shadow hover:bg-emerald-700 transition-all">Sim, Desmarcar</button>
            </div>
          </div>
        </div>
      )}

      {showTutorial && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4"><div className="flex items-center gap-2 text-emerald-600"><ShoppingCart size={28} /><h3 className="text-xl font-extrabold text-carrin-dark">Modo Mercado</h3></div><button onClick={() => setShowTutorial(false)} className="text-gray-400 hover:text-carrin-dark p-1 rounded-full hover:bg-gray-100 transition-colors" title="Fechar tutorial"><X size={24} /></button></div>
            <div className="space-y-3 text-sm text-gray-600 mb-6">
              <p>Este modo foi desenhado para facilitar sua vida e do seu parceiro(a) <strong>fisicamente nos corredores do supermercado</strong>:</p>
              <ul className="list-disc pl-5 space-y-2"><li><strong>Toque rápido:</strong> Os itens ficam maiores e fáceis de marcar com uma mão só enquanto empurra o carrinho.</li><li><strong>Preços em tempo real:</strong> Ao marcar um item como comprado, digite rapidamente o preço usando o teclado numérico.</li><li><strong>Total do Carrinho:</strong> Acompanhe o valor acumulado da compra na hora para evitar surpresas no caixa.</li><li><strong>Sessão inteligente:</strong> Você não precisa sair do modo Mercado para adicionar um item esquecido, utilize o botão <strong>+</strong> para adicionar um item rápido.</li></ul>
            </div>
            <button onClick={confirmTutorialAndEnter} className="w-full bg-emerald-600 text-white py-3.5 rounded-button font-bold text-sm shadow hover:bg-emerald-700 transition-all">Entendi, Entrar no Mercado</button>
          </div>
        </div>
      )}

      {priceModalItem && (() => {
        const parsedUnitPrice = priceInput.trim() !== '' ? parseFloat(priceInput.replace(/\./g, '').replace(',', '.')) : 0;
        const liveTotal = parsedUnitPrice * boughtQty;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-sm rounded-card p-6 shadow-xl animate-in fade-in duration-200">
              <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-carrin-dark truncate pr-4">{priceModalItem.name}</h3><button onClick={() => { setPriceModalItem(null); setPriceInput(''); }} className="text-gray-400 hover:text-carrin-dark shrink-0"><X size={20} /></button></div>
              <form onSubmit={handleSavePriceModal} className="flex flex-col gap-5">
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">Qtd comprada</p>
                  <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-small p-2">
                    <button type="button" onClick={() => setBoughtQty(q => Math.max(0.1, q - 1))} className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded text-gray-500 hover:text-carrin-dark hover:border-carrin-dark transition-colors shadow-sm"><Minus size={18} /></button>
                    <div className="flex flex-col items-center"><input type="number" step="any" value={boughtQty} onChange={(e) => setBoughtQty(Number(e.target.value))} className="w-20 text-center text-2xl font-extrabold bg-transparent outline-none text-carrin-dark"/>{priceModalItem.unit && (<span className="text-[10px] text-gray-400 font-bold uppercase">{priceModalItem.unit}</span>)}</div>
                    <button type="button" onClick={() => setBoughtQty(q => q + 1)} className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded text-gray-500 hover:text-carrin-dark hover:border-carrin-dark transition-colors shadow-sm"><Plus size={18} /></button>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">Valor Unitário</p>
                  <div className="relative"><span className="absolute left-3 top-3.5 text-gray-400 font-bold">R$</span><input type="tel" inputMode="numeric" placeholder="0,00" value={priceInput} onChange={handlePriceChange} autoFocus className="w-full pl-10 pr-3 py-3.5 bg-gray-50 border border-gray-200 rounded-small text-xl font-extrabold text-carrin-dark focus:outline-none focus:border-emerald-600 transition-colors"/></div>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-small flex justify-between items-center"><span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Total do item</span><span className="text-xl font-extrabold text-emerald-600">R$ {liveTotal.toFixed(2)}</span></div>
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => { executeToggle(priceModalItem.id, true, 0, null, null); setPriceModalItem(null); setPriceInput(''); }} className="w-1/2 bg-gray-100 text-gray-600 py-3 rounded-small font-bold text-sm hover:bg-gray-200 transition-colors">Pular valor</button>
                  <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-small font-bold text-sm shadow hover:bg-emerald-700 transition-all">Confirmar</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {showQuickIntro && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-extrabold text-carrin-dark mb-3">Lista Rápida</h3>
            <p className="text-sm text-gray-600 mb-5 leading-relaxed">Crie uma lista separada para aquele churrasco, festa ou compra inesperada.</p>
            <ul className="text-sm text-gray-500 mb-6 space-y-3 pl-1 font-medium">
              <li className="flex gap-2 items-start"><Check size={16} className="text-emerald-500 shrink-0 mt-0.5" /> Não mistura com os itens da Casa.</li>
              <li className="flex gap-2 items-start"><Check size={16} className="text-emerald-500 shrink-0 mt-0.5" /> Possui Modo Mercado e Histórico próprios.</li>
              <li className="flex gap-2 items-start"><Check size={16} className="text-emerald-500 shrink-0 mt-0.5" /> Todos os moradores podem acessar.</li>
            </ul>
            <div className="flex flex-col gap-2">
              <button onClick={handleConfirmQuickIntro} className="w-full bg-carrin-primary text-white py-3.5 rounded-button font-bold text-sm shadow hover:opacity-90 transition-all">Criar lista rápida</button>
              <button onClick={() => setShowQuickIntro(false)} className="w-full text-gray-500 py-3 rounded-button font-bold text-sm hover:bg-gray-50 transition-colors">Agora não</button>
            </div>
          </div>
        </div>
      )}

      {showCreateQuick && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white w-full max-w-sm rounded-card p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-carrin-dark mb-4">Nova lista rápida</h3>
            <input type="text" placeholder="Ex.: Churrasco, Festa, Viagem" value={quickListNameInput} onChange={(e) => setQuickListNameInput(e.target.value)} autoFocus className="w-full p-3 bg-gray-50 border border-gray-200 rounded-small text-sm focus:outline-none focus:border-emerald-600 mb-6" />
            <div className="flex gap-2">
              <button onClick={() => setShowCreateQuick(false)} disabled={listActionLoading} className="w-1/2 bg-gray-100 text-gray-600 py-3.5 rounded-button font-bold text-sm hover:bg-gray-200">Cancelar</button>
              <button onClick={handleCreateQuickList} disabled={listActionLoading} className="w-full bg-emerald-600 text-white py-3.5 rounded-button font-bold text-sm shadow hover:bg-emerald-700">{listActionLoading ? 'Criando...' : 'Criar Lista'}</button>
            </div>
          </div>
        </div>
      )}

      {showRenameQuick && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white w-full max-w-sm rounded-card p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-carrin-dark mb-4">Renomear lista</h3>
            <input type="text" value={quickListNameInput} onChange={(e) => setQuickListNameInput(e.target.value)} autoFocus className="w-full p-3 bg-gray-50 border border-gray-200 rounded-small text-sm focus:outline-none focus:border-emerald-600 mb-6" />
            <div className="flex gap-2">
              <button onClick={() => setShowRenameQuick(false)} disabled={listActionLoading} className="w-1/2 bg-gray-100 text-gray-600 py-3.5 rounded-button font-bold text-sm hover:bg-gray-200">Cancelar</button>
              <button onClick={handleRenameQuickList} disabled={listActionLoading} className="w-full bg-emerald-600 text-white py-3.5 rounded-button font-bold text-sm shadow hover:bg-emerald-700">{listActionLoading ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteQuick && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white w-full max-w-sm rounded-card p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-red-600 mb-3"><AlertCircle size={28} /><h3 className="text-xl font-extrabold text-carrin-dark">Excluir lista rápida?</h3></div>
            <p className="text-sm text-gray-600 mb-6">Os itens desta lista serão removidos da sua rotina e ela não será registrada no Histórico como uma compra concluída.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteQuick(false)} disabled={listActionLoading} className="w-1/2 bg-gray-100 text-gray-600 py-3.5 rounded-button font-bold text-sm hover:bg-gray-200">Cancelar</button>
              <button onClick={handleDeleteQuickList} disabled={listActionLoading} className="w-full bg-red-600 text-white py-3.5 rounded-button font-bold text-sm shadow hover:bg-red-700">{listActionLoading ? 'Excluindo...' : 'Excluir lista'}</button>
            </div>
          </div>
        </div>
      )}

      <AddItemModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingItem(null); }} onSave={handleSaveItem} initialData={editingItem} existingItems={items} homePreferences={homePreferences} onGoToExisting={(item) => { setIsModalOpen(false); setEditingItem(null); setSearchQuery(item.name); }} />
      <FinishShoppingModal isOpen={isFinishModalOpen} onClose={handleCloseFinishModal} onConfirm={handleConfirmFinishShopping} totalAmount={totalEstimated} totalItems={completedItems.length} loading={finishing} isQuickList={selectedListType === 'quick'} />
      <PushPermissionModal isOpen={showPushPrompt} onClose={handleDeclinePush} onConfirm={handleEnablePush} />

      {!isMarketMode && <BottomNav currentTab={currentTab} onTabChange={setCurrentTab} />}
    </div>
  );
}