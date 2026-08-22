import { useState } from 'react';
import { Bell, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface PushPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  // onConfirm agora retorna uma Promise para o Modal saber se deu certo
  onConfirm: () => Promise<boolean>;
}

export function PushPermissionModal({ isOpen, onClose, onConfirm }: PushPermissionModalProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setStatus('loading');
    
    // Dispara a cadeia inteira (Navegador -> Edge Function -> Banco)
    const success = await onConfirm();
    
    if (success) {
      setStatus('success');
      // Espera o usuário ler a vitória antes de fechar sozinho
      setTimeout(() => {
        onClose();
        setStatus('idle');
      }, 2500);
    } else {
      setStatus('error');
    }
  };

  const handleClose = () => {
    setStatus('idle');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-sm rounded-card p-6 shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-300 relative">
        
        {status !== 'loading' && (
          <button 
            onClick={handleClose} 
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        )}

        {status === 'idle' && (
          <>
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner relative">
              <Bell size={32} />
              <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-carrin-dark">Fique por dentro!</h3>
              <p className="text-sm text-gray-500">
                Receba alertas instantâneos quando alguém da sua casa alterar a lista ou finalizar compras.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={handleConfirm}
                className="w-full bg-emerald-600 text-white py-3.5 rounded-button font-bold text-sm shadow hover:bg-emerald-700 transition-all"
              >
                Permitir notificações
              </button>
              <button
                onClick={handleClose}
                className="w-full text-gray-500 py-3 rounded-button font-bold text-sm hover:bg-gray-50 transition-colors"
              >
                Agora não
              </button>
            </div>
          </>
        )}

        {status === 'loading' && (
          <div className="py-6 flex flex-col items-center gap-4">
            <Loader2 size={40} className="text-emerald-600 animate-spin" />
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-carrin-dark">Configurando aparelho...</h3>
              <p className="text-sm text-gray-500">Aguarde um instante.</p>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="py-6 flex flex-col items-center gap-4 animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-carrin-dark">Tudo certo!</h3>
              <p className="text-sm text-emerald-700 font-medium">Notificações ativadas neste aparelho.</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="py-4 flex flex-col items-center gap-4 animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-carrin-dark">Falha no registro</h3>
              <p className="text-sm text-gray-500">
                A permissão foi concedida, mas não conseguimos registrar este aparelho. Tente novamente.
              </p>
            </div>
            <button
              onClick={() => setStatus('idle')}
              className="w-full mt-2 bg-gray-100 text-gray-700 py-3.5 rounded-button font-bold text-sm hover:bg-gray-200 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        )}

      </div>
    </div>
  );
}