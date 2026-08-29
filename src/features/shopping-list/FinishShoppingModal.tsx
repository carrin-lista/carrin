import { useState, useRef, useEffect } from 'react';
import { X, Camera, CheckCircle2, DollarSign, ShoppingBag, Trash2, Store, CreditCard } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { historyService } from '../../services/historyService';

const PAYMENT_METHODS = ['Pix', 'Débito', 'Crédito', 'Dinheiro', 'Vale / Benefício', 'Outro'];

interface FinishShoppingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (receiptUrls: string[], marketName?: string, paymentMethods?: any[] | null) => Promise<void>;
  totalAmount: number;
  totalItems: number;
  loading: boolean;
  isQuickList?: boolean; 
}

export function FinishShoppingModal({
  isOpen,
  onClose,
  onConfirm,
  totalAmount,
  totalItems,
  loading,
  isQuickList = false 
}: FinishShoppingModalProps) {
  const { homeId } = useAuthStore();
  
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [marketName, setMarketName] = useState('');
  const [recentMarkets, setRecentMarkets] = useState<string[]>([]);
  const [payments, setPayments] = useState<{ method: string, amount: number }[]>([]);
  
  const [isCompletedState, setIsCompletedState] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && homeId) {
      historyService.getRecentMarkets(homeId).then(setRecentMarkets).catch(console.error);
    } else {
      setPayments([]);
    }
  }, [isOpen, homeId]);

  if (!isOpen) return null;

  let paymentWarning = null;
  let canSubmitPayment = true;
  
  if (payments.length > 1) {
    const totalP = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
    const diff = totalAmount - totalP;
    
    if (Math.abs(diff) > 0.01) {
      canSubmitPayment = false;
      if (diff > 0) {
        paymentWarning = `Faltam R$ ${diff.toFixed(2)} para completar o pagamento.`;
      } else {
        paymentWarning = `O pagamento ultrapassa o total em R$ ${Math.abs(diff).toFixed(2)}.`;
      }
    }
  }

  const handleCaptureImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (receiptFiles.length >= 3) {
      alert('Você pode adicionar no máximo 3 fotos da nota fiscal.');
      return;
    }

    const file = files[0];
    setReceiptFiles(prev => [...prev, file]);
    setPreviewUrls(prev => [...prev, URL.createObjectURL(file)]);
    e.target.value = '';
  };

  const handleRemoveReceipt = (index: number) => {
    setReceiptFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveAndFinish = async () => {
    if (localLoading || loading || !homeId || !canSubmitPayment) return;
    setLocalLoading(true);

    try {
      const uploadedUrls: string[] = [];
      for (const file of receiptFiles) {
        const url = await historyService.uploadReceipt(file, homeId);
        uploadedUrls.push(url);
      }

      const paymentPayload = payments.length > 0 ? payments.map(p => ({
        method: p.method,
        amount_cents: Math.round((payments.length === 1 ? totalAmount : p.amount) * 100)
      })) : null;

      await onConfirm(uploadedUrls, marketName.trim() || undefined, paymentPayload);

      setIsCompletedState(true);

      setTimeout(() => {
        setIsCompletedState(false);
        setReceiptFiles([]);
        setPreviewUrls([]);
        setMarketName('');
        setPayments([]);
        setLocalLoading(false);
        onClose();
      }, 3000);
    } catch (error) {
      console.error("Erro ao finalizar:", error);
      setLocalLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md max-h-[90vh] overflow-y-auto rounded-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        
        {isCompletedState ? (
          <div className="text-center py-10 space-y-3 animate-in fade-in duration-200">
            <CheckCircle2 size={64} className="text-emerald-600 mx-auto animate-bounce" />
            <h3 className="text-2xl font-extrabold text-carrin-dark">Compra concluída</h3>
            <p className="text-sm text-gray-500">
              {isQuickList 
                ? 'Sua compra foi salva no Histórico.' 
                : 'Histórico salvo com sucesso. Iniciando nova lista...'}
            </p>
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

            <div className="mb-6">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">
                Onde você comprou?
              </label>
              <div className="relative">
                <Store size={18} className="absolute left-3 top-3 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Nome do mercado (opcional)"
                  value={marketName}
                  onChange={(e) => setMarketName(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-small text-sm focus:outline-none focus:border-emerald-600 transition-colors"
                />
              </div>
              
              {recentMarkets.length > 0 && !marketName && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {recentMarkets.map((market, idx) => (
                    <button
                      key={idx}
                      onClick={() => setMarketName(market)}
                      className="text-xs font-semibold bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors"
                    >
                      {market}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* NOVA SESSÃO: PAGAMENTO */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard size={14} /> Pagamento
                </label>
                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Opcional</span>
              </div>

              {payments.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setPayments([{ method: 'Pix', amount: totalAmount }])}
                  className="w-full py-3 border border-dashed border-gray-300 rounded-small text-xs font-bold text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
                >
                  + Adicionar forma de pagamento
                </button>
              ) : (
                <div className="space-y-3 bg-gray-50 p-3 rounded-card border border-gray-100">
                  {payments.map((p, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <select
                        value={p.method}
                        onChange={(e) => {
                          const newP = [...payments];
                          newP[index].method = e.target.value;
                          setPayments(newP);
                        }}
                        className="flex-1 px-2 py-2.5 bg-white border border-gray-200 rounded-small text-sm font-semibold text-carrin-dark focus:outline-none focus:border-emerald-600"
                      >
                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>

                      {payments.length > 1 ? (
                        <div className="relative w-32 shrink-0">
                          <span className="absolute left-2 top-2.5 text-gray-400 font-bold text-sm">R$</span>
                          <input
                            type="number"
                            step="any"
                            value={p.amount || ''}
                            onChange={(e) => {
                              const newP = [...payments];
                              newP[index].amount = parseFloat(e.target.value) || 0;
                              setPayments(newP);
                            }}
                            className="w-full pl-8 pr-2 py-2.5 bg-white border border-gray-200 rounded-small text-sm font-bold text-carrin-dark focus:outline-none focus:border-emerald-600"
                          />
                        </div>
                      ) : (
                        <div className="w-32 shrink-0 py-2.5 px-3 bg-white border border-gray-200 rounded-small text-sm font-bold text-gray-500 text-right cursor-not-allowed">
                          R$ {totalAmount.toFixed(2)}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setPayments(payments.filter((_, i) => i !== index))}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}

                  {paymentWarning && (
                    <p className="text-xs font-bold text-amber-600 bg-amber-50 p-2 rounded-small border border-amber-100">
                      {paymentWarning}
                    </p>
                  )}

                  {!paymentWarning && payments.length > 1 && (
                    <p className="text-xs font-bold text-emerald-600 bg-emerald-50 p-2 rounded-small border border-emerald-100 flex items-center gap-1">
                      <CheckCircle2 size={14} /> Soma correta (R$ {totalAmount.toFixed(2)})
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const rem = Math.max(0, totalAmount - payments.reduce((acc, p) => acc + (p.amount || 0), 0));
                      setPayments([...payments, { method: 'Crédito', amount: rem }]);
                    }}
                    className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1 pt-1"
                  >
                    + Adicionar outra forma
                  </button>
                </div>
              )}
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Foto da Nota Fiscal ({receiptFiles.length}/3)
                </label>
                <span className="text-[11px] text-gray-400">Armazenamento seguro</span>
              </div>

              <input type="file" ref={fileInputRef} onChange={handleCaptureImage} accept="image/*" className="hidden" />

              <div className="grid grid-cols-3 gap-2">
                {previewUrls.map((imgSrc, index) => (
                  <div key={index} className="relative h-24 bg-gray-100 border rounded-small overflow-hidden group shadow-sm">
                    <a href={imgSrc} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-0">
                      <img src={imgSrc} alt={`Nota ${index + 1}`} className="w-full h-full object-cover" />
                    </a>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemoveReceipt(index); }} className="absolute inset-0 z-10 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-xs font-bold gap-1 cursor-pointer"><Trash2 size={16} /><span>Remover</span></button>
                  </div>
                ))}

                {receiptFiles.length < 3 && (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="h-24 border-2 border-dashed border-gray-300 rounded-small flex flex-col items-center justify-center text-gray-400 hover:border-carrin-primary hover:text-carrin-primary hover:bg-gray-50 transition-all">
                    <Camera size={24} />
                    <span className="text-[11px] mt-1 font-semibold">Adicionar</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="w-1/2 bg-gray-100 text-gray-600 py-3 rounded-button font-semibold text-sm hover:bg-gray-200 transition-all">Continuar Comprando</button>
              <button type="button" disabled={localLoading || loading || !canSubmitPayment} onClick={handleSaveAndFinish} className="w-1/2 bg-emerald-600 text-white py-3 rounded-button font-bold text-sm shadow hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center">{localLoading || loading ? 'Salvando...' : 'Salvar e Fechar'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}