import { Bell, X } from 'lucide-react';

interface PushPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function PushPermissionModal({ isOpen, onClose, onConfirm }: PushPermissionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-sm rounded-card p-6 shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-300 relative">
        
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>

        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner relative">
          <Bell size={32} />
          <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-extrabold text-carrin-dark">Fique por dentro!</h3>
          <p className="text-sm text-gray-500">
            Receba alertas instantâneos quando alguém da sua casa adicionar um produto na lista ou finalizar uma compra no mercado.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <button
            onClick={onConfirm}
            className="w-full bg-emerald-600 text-white py-3.5 rounded-button font-bold text-sm shadow hover:bg-emerald-700 transition-all"
          >
            Ativar Notificações
          </button>
          <button
            onClick={onClose}
            className="w-full text-gray-500 py-3 rounded-button font-bold text-sm hover:bg-gray-50 transition-colors"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}