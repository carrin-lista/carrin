import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DeleteAccount } from './DeleteAccount';

interface OtherOptionsProps {
  onBack: () => void;
}

export function OtherOptions({ onBack }: OtherOptionsProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  return (
    <div className="min-h-screen bg-carrin-bg p-6 pb-32 max-w-lg mx-auto space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 bg-white rounded-full shadow-sm text-gray-500 hover:text-carrin-dark">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-carrin-dark mb-0.5">Outras opções</h1>
      </div>

      <div className="bg-white rounded-card shadow-sm border border-gray-100 overflow-hidden">
        <div 
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors p-5"
        >
          <span className="text-sm font-medium text-gray-600">Excluir minha conta</span>
          <ChevronRight size={18} className="text-gray-400" />
        </div>
      </div>

      {showDeleteModal && <DeleteAccount onClose={() => setShowDeleteModal(false)} />}
    </div>
  );
}