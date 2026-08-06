import { useState, useEffect } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { X, Tag, Plus, Check, AlertCircle } from 'lucide-react';
import { predictCategory } from '../../utils/categoryPredictor';

const CATEGORIES = [
  '🛒 Mantimentos',
  '🍎 Hortifrúti',
  '🥩 Açougue',
  '🥛 Laticínios',
  '🧹 Limpeza',
  '🧴 Higiene',
  '📦 Outros'
];

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, quantity: string, observation: string, category_id: string) => Promise<void>;
  initialData?: { name: string; quantity?: string; observation?: string; category_id?: string } | null;
  existingItems?: any[];
  onGoToExisting?: (item: any) => void;
}

// Normaliza o nome: ignora maiúsculas/minúsculas, espaços extras e múltiplos espaços
const normalizeName = (str: string) => str.trim().toLowerCase().replace(/\s+/g, ' ');

export function AddItemModal({ isOpen, onClose, onSave, initialData, existingItems = [], onGoToExisting }: ItemModalProps) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [observation, setObservation] = useState('');
  const [category, setCategory] = useState('🛒 Mantimentos');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [duplicateItem, setDuplicateItem] = useState<any | null>(null);
  const [pendingData, setPendingData] = useState<{ isContinue: boolean } | null>(null);

  // Trava o scroll da página ao fundo quando o modal abre
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setQuantity(initialData.quantity || '');
      setObservation(initialData.observation || '');
      setCategory(initialData.category_id || '🛒 Mantimentos');
    } else {
      setName('');
      setQuantity('');
      setObservation('');
      setCategory('🛒 Mantimentos');
    }
    setErrorMsg(null);
    setToastMsg(null);
    setDuplicateItem(null);
    setPendingData(null);
  }, [initialData, isOpen]);

  useEffect(() => {
    if (!isOpen) setToastMsg(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);

    if (!initialData && value.length > 2) {
      const predicted = predictCategory(value);
      setCategory(predicted);
    }
  };

  const checkForDuplicate = (targetName: string) => {
    if (initialData) return null; // Não valida duplicidade em modo de edição
    const normalizedTarget = normalizeName(targetName);
    if (!normalizedTarget) return null;
    return existingItems.find(item => normalizeName(item.name) === normalizedTarget);
  };

  const handleSaveAndClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || loading) return;

    const duplicate = checkForDuplicate(name);
    if (duplicate) {
      setDuplicateItem(duplicate);
      setPendingData({ isContinue: false });
      return;
    }

    await executeSaveAndClose();
  };

  const executeSaveAndClose = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await onSave(name, quantity, observation, category);
      onClose();
    } catch (error: any) {
      console.error("Erro ao salvar item:", error);
      setErrorMsg(error.message || "Erro ao salvar item. Verifique o console.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndContinue = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const duplicate = checkForDuplicate(name);
    if (duplicate) {
      setDuplicateItem(duplicate);
      setPendingData({ isContinue: true });
      return;
    }

    executeSaveAndContinue();
  };

  const executeSaveAndContinue = () => {
    const currentName = name;
    const currentQuantity = quantity;
    const currentObservation = observation;
    const currentCategory = category;

    setName('');
    setQuantity('');
    setObservation('');
    setCategory('🛒 Mantimentos');
    
    setToastMsg(`${currentName} adicionado!`);
    setTimeout(() => setToastMsg(null), 3000);

    onSave(currentName, currentQuantity, currentObservation, currentCategory).catch((error: any) => {
      console.error("Erro no salvamento contínuo:", error);
      setErrorMsg(error.message || "Erro ao salvar o item anterior.");
    });
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
        <div className="bg-white w-full max-w-md rounded-t-card sm:rounded-card p-6 shadow-lg animate-in fade-in slide-in-from-bottom duration-200 relative overflow-hidden">
          
          {/* MODAL DE AVISO DE DUPLICIDADE */}
          {duplicateItem && (
            <div className="absolute inset-0 bg-white z-30 flex flex-col justify-center p-6 animate-in fade-in duration-150">
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
                    if (isContinue) {
                      executeSaveAndContinue();
                    } else {
                      executeSaveAndClose();
                    }
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
              onClick={!loading ? onClose : undefined} 
              className="text-gray-400 hover:text-carrin-dark"
            >
              <X size={24} />
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-small text-xs font-medium bg-red-50 text-red-600">
              {errorMsg}
            </div>
          )}

          <form id="add-item-form" onSubmit={handleSaveAndClose} className="flex flex-col gap-3">
            <Input
              label="O que falta comprar?"
              placeholder="Ex: Detergente, Leite, Tomate..."
              value={name}
              onChange={handleNameChange}
              required
              autoFocus
            />

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
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
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
                    className="w-14 h-14 shrink-0 bg-carrin-primary text-white rounded-full shadow-xl flex items-center justify-center hover:bg-emerald-600 hover:scale-105 active:scale-95 transition-all"
                    title="Adicionar próximo item"
                  >
                    <Plus size={28} strokeWidth={2.5} />
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