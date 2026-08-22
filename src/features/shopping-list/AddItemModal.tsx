import { useState, useEffect } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { X, Tag, Plus, Check, AlertCircle, History } from 'lucide-react';
import { analyzeItemInput } from '../../utils/categoryPredictor';
import { preferenceService } from '../../services/preferenceService';
import { useAuthStore } from '../../stores/useAuthStore';
import { itemService } from '../../services/itemService';


export const CATEGORIES = [
  '🛒 Mantimentos', '🍎 Hortifrúti', '🥩 Açougue', '🥛 Laticínios',
  '🧹 Limpeza', '🧴 Higiene', '🍺 Bebidas', '🐶 Pet',
  '👶 Bebê', '🏠 Utilidades', '📦 Outros'
];

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, quantity: number | null, unit: string | null, observation: string, category_id: string) => Promise<void>;
  initialData?: { name: string; quantity?: number | null; unit?: string | null; observation?: string; category_id?: string } | null;
  existingItems?: any[];
  homePreferences: Record<string, string>;
  onGoToExisting?: (item: any) => void;
}

const normalizeName = (str: string) => str.trim().toLowerCase().replace(/\s+/g, ' ');

export function AddItemModal({ isOpen, onClose, onSave, initialData, existingItems = [], homePreferences, onGoToExisting }: ItemModalProps) {
  const { user, homeId } = useAuthStore();
  
  const [name, setName] = useState('');
  const [quantityInput, setQuantityInput] = useState('');
  const [observation, setObservation] = useState('');
  const [category, setCategory] = useState('🛒 Mantimentos');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [duplicateItem, setDuplicateItem] = useState<any | null>(null);
  const [pendingData, setPendingData] = useState<{ isContinue: boolean } | null>(null);

  // Sugestões do Histórico
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setQuantityInput(initialData.quantity ? `${initialData.quantity} ${initialData.unit || ''}`.trim() : '');
      setObservation(initialData.observation || '');
      setCategory(initialData.category_id || '🛒 Mantimentos');
    } else {
      setName('');
      setQuantityInput('');
      setObservation('');
      setCategory('🛒 Mantimentos');
    }
    setErrorMsg(null);
    setToastMsg(null);
    setDuplicateItem(null);
    setPendingData(null);
    setSuggestions([]);
    setShowSuggestions(false);
  }, [initialData, isOpen]);

  // Efeito de Debounce para Sugestões (Leve para o Banco)
  useEffect(() => {
    if (!homeId || initialData || name.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      const data = await itemService.getRecentItemSuggestions(homeId, name);
      setSuggestions(data);
      setShowSuggestions(data.length > 0);
    }, 300);

    return () => clearTimeout(timer);
  }, [name, homeId, initialData]);

  const dismissKeyboard = () => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const handleClose = () => {
    dismissKeyboard();
    onClose();
  };

  if (!isOpen) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);

    if (!initialData && value.length > 2) {
      const { category: predictedCategory, extractedQuantity, normalizedName } = analyzeItemInput(value);
      let finalCategory = predictedCategory;
      if (normalizedName && homePreferences[normalizedName]) {
        finalCategory = homePreferences[normalizedName];
      }
      setCategory(finalCategory);
      if (extractedQuantity && !quantityInput) setQuantityInput(extractedQuantity);
    }
  };

  const applySuggestion = (s: any) => {
    setName(s.name);
    
    // Prioriza quantidade comprada, faz fallback para quantidade planejada original
    const idealQty = s.bought_quantity || s.quantity;
    if (idealQty) {
      setQuantityInput(`${idealQty} ${s.unit || ''}`.trim());
    }

    const { category: predictedCategory, normalizedName } = analyzeItemInput(s.name);
    if (normalizedName && homePreferences[normalizedName]) {
      setCategory(homePreferences[normalizedName]);
    } else {
      setCategory(predictedCategory);
    }

    setShowSuggestions(false);
    
    // CORREÇÃO UX: Fechar teclado apenas APÓS o preenchimento bem-sucedido
    dismissKeyboard();
  };

  const checkForDuplicate = (targetName: string) => {
    if (initialData) return null;
    const normalizedTarget = normalizeName(targetName);
    if (!normalizedTarget) return null;
    return existingItems.find(item => normalizeName(item.name) === normalizedTarget);
  };

  const checkAndLearnCategory = () => {
    if (!homeId || !user) return;
    const { category: predictedCategory, normalizedName } = analyzeItemInput(name);
    if (!normalizedName) return;
    const expectedCategory = homePreferences[normalizedName] || predictedCategory;
    if (category !== expectedCategory) {
      preferenceService.saveHomeCategoryPreference(homeId, normalizedName, category, user.id).catch(console.error);
    }
  };

  const parseQuantityInput = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return { qty: null, unt: null };

    const match = trimmed.match(/^([\d.,]+)\s*(.*)$/);
    if (match) {
      const qty = parseFloat(match[1].replace(',', '.'));
      const unt = match[2].trim() || null;
      return { qty: isNaN(qty) ? null : qty, unt };
    }
    return { qty: null, unt: trimmed };
  };

  const handleSaveAndClose = async (e: React.FormEvent) => {
    e.preventDefault();
    dismissKeyboard();
    if (!name.trim() || loading) return;

    const duplicate = checkForDuplicate(name);
    if (duplicate) {
      setDuplicateItem(duplicate);
      setPendingData({ isContinue: false });
      return;
    }

    checkAndLearnCategory();
    await executeSaveAndClose();
  };

  const executeSaveAndClose = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { qty, unt } = parseQuantityInput(quantityInput);
      await onSave(name, qty, unt, observation, category);
      handleClose();
    } catch (error: any) {
      console.error("Erro ao salvar item:", error);
      setErrorMsg(error.message || "Erro ao salvar item.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndContinue = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!name.trim() || loading) return;

    const duplicate = checkForDuplicate(name);
    if (duplicate) {
      setDuplicateItem(duplicate);
      setPendingData({ isContinue: true });
      return;
    }

    checkAndLearnCategory();
    await executeSaveAndContinue();
  };

  const executeSaveAndContinue = async () => {
    const currentName = name;
    const { qty, unt } = parseQuantityInput(quantityInput);
    const currentObservation = observation;
    const currentCategory = category;

    setLoading(true);
    setErrorMsg(null);

    try {
      await onSave(currentName, qty, unt, currentObservation, currentCategory);
      setName('');
      setQuantityInput('');
      setObservation('');
      setCategory('🛒 Mantimentos');
      setSuggestions([]);
      setShowSuggestions(false);
      
      setToastMsg(`${currentName} adicionado!`);
      setTimeout(() => setToastMsg(null), 3000);
    } catch (error: any) {
      console.error("Erro no salvamento contínuo:", error);
      setErrorMsg(error.message || "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  };

  const isEditing = !!initialData;

  return (
    <>
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-[#059669] text-white px-5 py-2.5 rounded-full flex items-center gap-4 shadow-lg z-[9999] w-max max-w-[90vw] animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2">
            <Check size={18} strokeWidth={2.5} />
            <span className="font-semibold text-sm truncate">{toastMsg}</span>
          </div>
          <button 
            onClick={() => setToastMsg(null)} 
            className="opacity-80 hover:opacity-100 flex-shrink-0 flex items-center"
            type="button"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
      )}

      <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
        <div className="bg-white w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-card sm:rounded-card p-6 shadow-lg animate-in fade-in slide-in-from-bottom duration-200 relative">
          
          {duplicateItem && (
            <div className="absolute inset-0 bg-white z-30 flex flex-col justify-center p-6 animate-in fade-in duration-150 rounded-t-card sm:rounded-card">
              <div className="flex items-center gap-2 text-amber-600 mb-3">
                <AlertCircle size={28} />
                <h3 className="text-xl font-extrabold text-carrin-dark">Item Já Existente</h3>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                ⚠️ Já existe um item com este nome na lista (<strong>{duplicateItem.name}</strong>).
              </p>
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (onGoToExisting) onGoToExisting(duplicateItem);
                    setDuplicateItem(null);
                  }}
                  className="w-full bg-emerald-600 text-white py-3 rounded-button font-bold text-sm shadow hover:bg-emerald-700 transition-all"
                >
                  Ir para o item existente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const isContinue = pendingData?.isContinue;
                    setDuplicateItem(null);
                    setPendingData(null);
                    if (isContinue) executeSaveAndContinue();
                    else executeSaveAndClose();
                  }}
                  className="w-full bg-gray-100 text-gray-700 py-3 rounded-button font-bold text-sm hover:bg-gray-200 transition-colors"
                >
                  Adicionar mesmo assim
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDuplicateItem(null);
                    setPendingData(null);
                  }}
                  className="w-full text-gray-500 py-2 text-xs font-semibold hover:underline"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-carrin-dark">
              {isEditing ? 'Editar Item' : 'Novo Item'}
            </h3>
            <button 
              type="button" 
              onClick={!loading ? handleClose : undefined} 
              className="text-gray-400 hover:text-carrin-dark bg-gray-50 hover:bg-gray-100 p-1 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-small text-xs font-medium bg-red-50 text-red-600">
              {errorMsg}
            </div>
          )}

          <form id="add-item-form" onSubmit={handleSaveAndClose} className="flex flex-col gap-3 pb-safe">
            <div className="flex flex-col gap-1 relative">
              <Input
                label="O que falta comprar?"
                placeholder="Ex: Detergente, Leite, Tomate..."
                value={name}
                onChange={handleNameChange}
                required
                autoFocus
              />
              
              {/* Dropdown de Sugestões Integrado ao Fluxo (sem absolute, max 3) */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="flex flex-col mt-1 bg-gray-50 border border-gray-200 rounded-small overflow-hidden transition-all animate-in fade-in duration-200">
                  {suggestions.slice(0, 3).map((s, idx) => {
                    const idealQty = s.bought_quantity || s.quantity;
                    return (
                      <button
                        key={idx}
                        type="button"
                        /* CORREÇÃO UX: onPointerDown + preventDefault evita que o blur do input aconteça antes do clique registrar, garantindo seleção em 1 toque */
                        onPointerDown={(e) => {
                          e.preventDefault();
                          applySuggestion(s);
                        }}
                        className="flex flex-col items-start px-3 py-1.5 hover:bg-emerald-50 focus:bg-emerald-50 border-b border-gray-100 last:border-0 transition-colors w-full text-left outline-none"
                      >
                        <div className="flex justify-between items-center w-full">
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <History size={12} className="text-gray-400 shrink-0" />
                            <span className="text-sm font-bold text-carrin-dark truncate">{s.name}</span>
                          </div>
                          {idealQty && (
                            <span className="text-[10px] font-bold text-gray-500 shrink-0 ml-2">
                              {idealQty} {s.unit}
                            </span>
                          )}
                        </div>
                        {s.unit_price > 0 && (
                          <div className="ml-5 mt-0.5">
                            <span className="text-[9px] font-medium text-gray-500">
                              Última vez: R$ {Number(s.unit_price).toFixed(2)} cada
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-carrin-dark flex items-center gap-1">
                <Tag size={14} className="text-carrin-primary" /> Categoria (Auto-detectada)
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-small text-sm text-carrin-dark focus:outline-none focus:border-carrin-primary"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <div className="w-1/2">
                <Input
                  label="Quantidade (opcional)"
                  placeholder="Ex: 2L, 1kg"
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="w-1/2">
                <Input
                  label="Obs (opcional)"
                  placeholder="Ex: Marca X"
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="mt-4 flex gap-3 items-center">
              {!isEditing ? (
                <>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gray-100 text-gray-600 py-4 rounded-button font-bold text-sm hover:bg-gray-200 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : 'Adicionar e Fechar'}
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleSaveAndContinue}
                    disabled={loading}
                    className="w-14 h-14 shrink-0 bg-carrin-primary text-white rounded-full shadow-xl flex items-center justify-center hover:bg-emerald-600 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
                    title="Adicionar próximo item"
                  >
                    {loading ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : (
                      <Plus size={28} strokeWidth={2.5} />
                    )}
                  </button>
                </>
              ) : (
                <div className="w-full">
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </>
  );
}