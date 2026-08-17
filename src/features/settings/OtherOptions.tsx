import { useState } from 'react';
import { ChevronLeft, ChevronRight, Smartphone } from 'lucide-react';
import { DeleteAccount } from './DeleteAccount';
import { IOSInstallModal } from '../../components/pwa/IOSInstallModal';
import { isIOSDevice } from '../../utils/iosDetect';

interface OtherOptionsProps {
  onBack: () => void;
}

export function OtherOptions({ onBack }: OtherOptionsProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showManualInstall, setShowManualInstall] = useState(false);

  return (
    <div className="min-h-screen bg-carrin-bg p-6 pb-32 max-w-lg mx-auto space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 bg-white rounded-full shadow-sm text-gray-500 hover:text-carrin-dark">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-carrin-dark mb-0.5">Outras opções</h1>
      </div>

      <div className="bg-white rounded-[1.5rem] shadow-sm border border-gray-100 overflow-hidden">
        
        {/* BOTÃO DO TUTORIAL MANUAL (Só exibe se estiver no iOS) */}
        {isIOSDevice() && (
          <div 
            onClick={() => setShowManualInstall(true)}
            className="flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors p-5 border-b border-gray-50"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                <Smartphone size={16} className="text-emerald-600" />
              </div>
              <span className="text-sm font-bold text-gray-700">Instalar aplicativo no iPhone</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </div>
        )}
        
        {/* BOTÃO EXCLUIR CONTA */}
        <div 
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors p-5"
        >
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-transparent flex items-center justify-center"></div>
             <span className="text-sm font-medium text-gray-600">Excluir minha conta</span>
          </div>
          <ChevronRight size={18} className="text-gray-400" />
        </div>

      </div>

      {showDeleteModal && <DeleteAccount onClose={() => setShowDeleteModal(false)} />}
      
      {/* O MODAL MANUAL FICA EMBUTIDO AQUI */}
      <IOSInstallModal 
        isOpen={showManualInstall} 
        onClose={() => setShowManualInstall(false)} 
      />
      
    </div>
  );
}