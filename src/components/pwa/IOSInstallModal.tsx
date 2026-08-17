import { X, Share, PlusSquare, ArrowUp, MoreHorizontal, ChevronDown } from 'lucide-react';
import { IOS_DISMISS_KEY } from '../../utils/iosDetect';

interface IOSInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IOSInstallModal({ isOpen, onClose }: IOSInstallModalProps) {
  if (!isOpen) return null;

  const handleDismiss = () => {
    localStorage.setItem(IOS_DISMISS_KEY, 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-xl overflow-hidden animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 border border-gray-100 p-6">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
              📲
            </span>
            <h2 className="text-base font-bold text-gray-800">Instalar o Carrin</h2>
          </div>
          <button 
            onClick={handleDismiss} 
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-5">
          <p className="text-sm text-gray-600 leading-relaxed font-medium">
            Adicione o Carrin à sua Tela de Início para ter uma experiência de aplicativo completo e acesso rápido.
          </p>

          <div className="space-y-4 bg-gray-50 p-5 rounded-3xl border border-gray-100">
            {/* Passo 1 */}
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                1
              </span>
              <p className="text-sm text-gray-700 font-medium leading-relaxed">
                Toque no menu <strong className="text-gray-900">...</strong> na barra do seu navegador <MoreHorizontal size={16} className="inline mx-0.5 text-gray-700" />.
              </p>
            </div>

            {/* Passo 2 */}
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                2
              </span>
              <p className="text-sm text-gray-700 font-medium leading-relaxed">
                Selecione <strong className="text-gray-900">Compartilhar</strong> <Share size={14} className="inline mx-0.5 text-blue-500" />.
              </p>
            </div>

            {/* Passo 3 */}
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                3
              </span>
              <p className="text-sm text-gray-700 font-medium leading-relaxed">
                Desça e toque em <strong className="text-gray-900">Ver mais</strong> <ChevronDown size={16} className="inline mx-0.5 text-gray-500" />.
              </p>
            </div>

            {/* Passo 4 */}
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                4
              </span>
              <p className="text-sm text-gray-700 font-medium leading-relaxed">
                Escolha <strong className="text-gray-900">Adicionar à Tela de Início</strong> <PlusSquare size={14} className="inline mx-0.5 text-gray-700" /> e confirme.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-600 font-medium pt-1">
            <ArrowUp size={16} className="animate-bounce" />
            <span>A barra do navegador fica aqui embaixo</span>
          </div>

          {/* Botões de Ação Redondos */}
          <div className="flex items-center gap-3 pt-2">
            <button 
              type="button"
              onClick={handleDismiss}
              className="flex-1 px-4 py-3.5 bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm font-bold rounded-full transition-colors"
            >
              Agora não
            </button>
            <button 
              type="button"
              onClick={handleDismiss}
              className="flex-1 px-4 py-3.5 bg-emerald-600 text-white text-sm font-bold rounded-full shadow-sm hover:bg-emerald-700 transition-all"
            >
              Entendido
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}