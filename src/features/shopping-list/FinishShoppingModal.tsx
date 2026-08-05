import { useState, useRef } from 'react';
import { X, Camera, CheckCircle2, DollarSign, ShoppingBag, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { historyService } from '../../services/historyService';

interface FinishShoppingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (receiptUrls: string[]) => Promise<void>;
  totalAmount: number;
  totalItems: number;
  loading: boolean;
}

export function FinishShoppingModal({
  isOpen,
  onClose,
  onConfirm,
  totalAmount,
  totalItems,
  loading
}: FinishShoppingModalProps) {
  const { homeId } = useAuthStore();
  
  // Guardamos o arquivo real para enviar ao banco
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  // Guardamos uma URL temporária apenas para mostrar a imagem na tela
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  
  const [isCompletedState, setIsCompletedState] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCaptureImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (receiptFiles.length >= 3) {
      alert('Você pode adicionar no máximo 3 fotos da nota fiscal.');
      return;
    }

    const file = files[0];
    
    // Salva o arquivo real
    setReceiptFiles(prev => [...prev, file]);
    // Cria uma URL local rápida para mostrar a miniatura na hora
    setPreviewUrls(prev => [...prev, URL.createObjectURL(file)]);
    
    e.target.value = '';
  };

  const handleRemoveReceipt = (index: number) => {
    setReceiptFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveAndFinish = async () => {
    if (localLoading || loading || !homeId) return;
    setLocalLoading(true);

    try {
      // 1. Faz o upload de todas as fotos para o Storage e guarda os links gerados
      const uploadedUrls: string[] = [];
      for (const file of receiptFiles) {
        const url = await historyService.uploadReceipt(file, homeId);
        uploadedUrls.push(url);
      }

      // 2. Executa o salvamento e desativação do Modo Mercado passando as URLs finais
      await onConfirm(uploadedUrls);

      // 3. Exibe o estado especial de sucesso por 3 segundos
      setIsCompletedState(true);

      setTimeout(() => {
        setIsCompletedState(false);
        setReceiptFiles([]);
        setPreviewUrls([]);
        setLocalLoading(false);
        onClose();
      }, 3000);
    } catch (error) {
      console.error("Erro ao finalizar:", error);
      alert("Houve um erro ao salvar as fotos. Tente novamente.");
      setLocalLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Estado Especial: Compra Concluída (Exibição por 3 segundos) */}
        {isCompletedState ? (
          <div className="text-center py-10 space-y-3 animate-in fade-in duration-200">
            <CheckCircle2 size={64} className="text-emerald-600 mx-auto animate-bounce" />
            <h3 className="text-2xl font-extrabold text-carrin-dark">Compra concluída</h3>
            <p className="text-sm text-gray-500">Histórico salvo com sucesso. Iniciando nova lista...</p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-carrin-dark">
                <CheckCircle2 size={24} className="text-emerald-600" />
                <h3 className="text-lg font-bold">Resumo da Compra</h3>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-carrin-dark">
                <X size={20} />
              </button>
            </div>

            {/* Bloco de Indicadores da Compra */}
            <div className="bg-gray-50 border border-gray-100 rounded-card p-4 mb-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                  <ShoppingBag size={16} /> Total de itens comprados
                </span>
                <span className="font-bold text-carrin-dark">{totalItems} itens</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-200 pt-3">
                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                  <DollarSign size={16} /> Valor total gasto
                </span>
                <span className="text-xl font-extrabold text-emerald-600">
                  R$ {totalAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Seção de Nota Fiscal (Câmera Nativa / Até 3 fotos) */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Foto da Nota Fiscal ({receiptFiles.length}/3)
                </label>
                <span className="text-[11px] text-gray-400">Armazenamento seguro</span>
              </div>

              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleCaptureImage}
                accept="image/*"
                capture="environment"
                className="hidden"
              />

              <div className="grid grid-cols-3 gap-2">
                {previewUrls.map((imgSrc, index) => (
                  <div key={index} className="relative h-24 bg-gray-100 border rounded-small overflow-hidden group shadow-sm">
                    <img src={imgSrc} alt={`Nota ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveReceipt(index)}
                      className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-xs font-bold gap-1"
                    >
                      <Trash2 size={16} />
                      <span>Remover</span>
                    </button>
                  </div>
                ))}

                {receiptFiles.length < 3 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-24 border-2 border-dashed border-gray-300 rounded-small flex flex-col items-center justify-center text-gray-400 hover:border-carrin-primary hover:text-carrin-primary hover:bg-gray-50 transition-all"
                  >
                    <Camera size={24} />
                    <span className="text-[11px] mt-1 font-semibold">Tirar Foto</span>
                  </button>
                )}
              </div>
            </div>

            {/* Ações */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-1/2 bg-gray-100 text-gray-600 py-3 rounded-button font-semibold text-sm hover:bg-gray-200 transition-all"
              >
                Continuar Comprando
              </button>
              <button
                type="button"
                disabled={localLoading || loading}
                onClick={handleSaveAndFinish}
                className="w-1/2 bg-emerald-600 text-white py-3 rounded-button font-bold text-sm shadow hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center"
              >
                {localLoading || loading ? 'Salvando...' : 'Salvar e Fechar'}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}