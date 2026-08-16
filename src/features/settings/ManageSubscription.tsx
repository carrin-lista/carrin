import { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { supabase } from '../../services/supabase';
import { ChevronLeft, CreditCard, AlertTriangle, Check, AlertCircle, ChevronRight } from 'lucide-react';

interface ManageSubscriptionProps {
  onBack: () => void;
  commercialContext: any;
}

export function ManageSubscription({ onBack, commercialContext }: ManageSubscriptionProps) {
  const { user, homeId } = useAuthStore();
  
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleCancelSubscription = async () => {
    if (!user || !homeId) return;

    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'SUA_URL_AQUI'; 
      
      // SOLUÇÃO DO TOKEN: Pegamos a sessão diretamente do cliente oficial (À prova de falhas)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error("Sessão inválida. Faça login novamente.");
      
      const accessToken = session.access_token;

      const response = await fetch(`${supabaseUrl}/functions/v1/asaas-cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ home_id: homeId })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao cancelar assinatura.");
      }

      showFeedback('success', 'Assinatura cancelada com sucesso. Você terá acesso até o fim do período já pago.');
      setShowConfirmCancel(false);
      
      setTimeout(() => {
        onBack();
      }, 3000);

    } catch (error: any) {
      console.error(error);
      showFeedback('error', error.message || 'Falha na comunicação com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '--/--/----';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="min-h-screen bg-carrin-bg p-6 pb-32 max-w-lg mx-auto space-y-6 relative animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {feedback && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-card shadow-lg text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200 whitespace-nowrap w-max max-w-[95vw] overflow-hidden ${feedback.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {feedback.type === 'success' ? <Check size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
          <span className="truncate">{feedback.text}</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 bg-white rounded-full shadow-sm text-gray-500 hover:text-carrin-dark">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-carrin-dark mb-0.5">Gestão de Assinatura</h1>
          <p className="text-gray-500 text-xs">Administre o plano da sua Casa</p>
        </div>
      </div>

      <div className="bg-white rounded-card p-5 shadow-sm space-y-5 border border-gray-100">
        <div className="flex items-center gap-2 text-carrin-dark font-semibold pb-2 border-b border-gray-50">
          <CreditCard size={18} className={commercialContext?.can_write ? 'text-emerald-600' : 'text-amber-500'} />
          <span>Status do Plano</span>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-medium">Situação Atual</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-small ${
              commercialContext?.can_write ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}>
              {commercialContext?.can_write ? 'Acesso Liberado' : 'Acesso Suspenso'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-medium">Limite de Moradores</span>
            <span className="text-sm font-bold text-carrin-dark">{commercialContext?.effective_limit || 5} pessoas</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-medium">Fim do Ciclo Atual</span>
            <span className="text-sm font-bold text-carrin-dark">{formatDate(commercialContext?.current_period_end)}</span>
          </div>
        </div>

        {commercialContext?.status === 'PAST_DUE' && (
          <div className="bg-amber-50 text-amber-800 p-3 rounded-small text-xs flex gap-2 font-medium border border-amber-200">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>Identificamos um atraso no pagamento. Seu acesso poderá ser restrito. Regularize a situação ou cancele a assinatura abaixo para interromper a cobrança.</span>
          </div>
        )}
      </div>

      {/* NOVA INTERFACE CLEAN PARA CANCELAMENTO */}
      {commercialContext?.status !== 'CANCELLED' && (
        <div className="bg-white rounded-card shadow-sm border border-gray-100 overflow-hidden">
          {!showConfirmCancel ? (
            <div 
              onClick={() => setShowConfirmCancel(true)}
              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors p-4"
            >
              <span className="text-sm font-medium text-gray-600">Cancelar assinatura</span>
              <ChevronRight size={18} className="text-gray-400" />
            </div>
          ) : (
            <div className="p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <p className="text-sm text-gray-600 font-medium leading-relaxed">
                Ao cancelar, sua assinatura continuará ativa até o final do período já pago. Após isso, a Casa retornará às restrições do plano gratuito.
              </p>
              
              <div className="flex items-center gap-3 pt-3 border-t border-gray-50">
                <button
                  onClick={() => setShowConfirmCancel(false)}
                  className="flex-1 px-4 py-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-50 bg-white border border-gray-200 text-xs font-bold rounded-lg transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleCancelSubscription}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Processando...' : 'Confirmar cancelamento'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
    </div>
  );
}