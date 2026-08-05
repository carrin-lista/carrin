import { useState, useEffect } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { X, Tag } from 'lucide-react';
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
}

export function AddItemModal({ isOpen, onClose, onSave, initialData }: ItemModalProps) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [observation, setObservation] = useState('');
  const [category, setCategory] = useState('🛒 Mantimentos');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);

    if (!initialData && value.length > 2) {
      const predicted = predictCategory(value);
      setCategory(predicted);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || loading) return;

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

  const isEditing = !!initialData;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full max-w-md rounded-t-card sm:rounded-card p-6 shadow-lg animate-in fade-in slide-in-from-bottom duration-200">
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            label="O que falta comprar?"
            placeholder="Ex: Detergente, Leite, Tomate..."
            value={name}
            onChange={handleNameChange}
            required
            autoFocus
            disabled={loading}
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

          <div className="mt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Adicionar à Lista'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}