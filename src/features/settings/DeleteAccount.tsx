import { useState, useEffect } from 'react';
import { accountService, type EligibilityResult } from '../../services/accountService';
import { supabase } from '../../services/supabase';
import { X, Loader2 } from 'lucide-react';

interface DeleteAccountProps {
  onClose: () => void;
}

export function DeleteAccount({ onClose }: DeleteAccountProps) {
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadEligibility();
  }, []);

  const loadEligibility = async () => {
    try {
      setLoading(true);
      setErrorFeedback(null);
      const result = await accountService.checkEligibility();
      setEligibility(result);
    } catch (error: any) {
      console.error("Erro na verificação capturado pela UI:", error);
      setErrorFeedback('Não conseguimos verificar sua conta agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText !== 'EXCLUIR') return;
    
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) throw error;

      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (error: any) {
      // LOG TURBINADO PARA DIAGNÓSTICO
      console.error('🔍 [DELETE ACCOUNT ERROR] Detalhes completos:', error);
      if (error.context) {
        console.error('Contexto do erro:', error.context);
      }
      
      setErrorFeedback('Falha ao processar exclusão. Tente novamente mais tarde.');
      setDeleting(false);
    }
  };

  const renderBlockerAction = (code: string) => {
    switch (code) {
      case 'OWNER_HAS_MEMBERS': 
        return <button onClick={onClose} className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors">Entendi</button>;
      case 'ACTIVE_SUBSCRIPTION':
      case 'PAST_DUE':
        return <button onClick={onClose} className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors">Voltar aos Ajustes</button>;
      default:
        return <button onClick={onClose} className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors">Falar com suporte</button>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 border border-gray-100">
        
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="text-sm font-bold text-gray-800">Excluir minha conta</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 sm:p-6">
          {errorFeedback && (
            <div className="mb-4 bg-red-50 text-red-600 text-xs font-semibold p-3 rounded-lg border border-red-100">
              {errorFeedback}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-6 text-gray-500">
              <Loader2 size={24} className="animate-spin mb-3 text-gray-300" />
              <p className="text-sm font-medium">Verificando sua conta...</p>
            </div>
          ) : eligibility?.can_delete === false ? (
            <div className="space-y-5">
              <div className="space-y-3">
                {eligibility.blockers.map((blocker) => (
                  <p key={blocker.code} className="text-sm text-gray-600 leading-relaxed font-medium">
                    {blocker.message}
                  </p>
                ))}
              </div>
              <div className="flex justify-end pt-2 border-t border-gray-50">
                {eligibility.blockers.length > 0 && renderBlockerAction(eligibility.blockers[0].code)}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-gray-600 font-medium">
                Se você continuar, sua conta e seus dados pessoais serão removidos permanentemente.
              </p>
              
              <form onSubmit={handleDelete} className="space-y-6">
                <div className="flex flex-col sm:items-center space-y-2">
                  <label className="text-xs font-bold text-gray-400">
                    Digite EXCLUIR para confirmar.
                  </label>
                  <input 
                    type="text"
                    placeholder="EXCLUIR"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="w-full sm:w-[220px] bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-center font-bold text-gray-800 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 uppercase transition-all tracking-wider"
                  />
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <button 
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 text-gray-500 hover:text-gray-700 text-xs font-bold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={confirmText !== 'EXCLUIR' || deleting}
                    className="px-5 py-2.5 bg-red-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? 'Aguarde...' : 'Excluir minha conta'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}