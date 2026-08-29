import { usePwaStore } from '../stores/usePwaStore';
import { Download } from 'lucide-react';

export function PwaUpdater() {
  const { updateAvailable, applyUpdate } = usePwaStore();

  if (!updateAvailable) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] w-max max-w-[90vw] bg-carrin-dark text-white px-5 py-3 rounded-card shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex flex-col">
        <p className="text-sm font-bold flex items-center gap-1.5 text-white">
          <Download size={16} className="text-emerald-400" /> Nova versão disponível
        </p>
        <p className="text-[11px] text-gray-300 mt-0.5">O Carrin recebeu uma atualização.</p>
      </div>
      <button 
        onClick={applyUpdate} 
        className="bg-emerald-600 text-white px-3 py-2 rounded-small text-xs font-bold shadow hover:bg-emerald-500 transition-colors"
      >
        Atualizar agora
      </button>
    </div>
  );
}