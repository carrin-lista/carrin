import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { homeService } from '../../services/homeService';
import { supabase } from '../../services/supabase';
import { Home as HomeIcon, CheckCircle2, AlertCircle, X } from 'lucide-react';

interface InviteViewProps {
  inviteId: string;
  onAccepted: () => void;
}

export function InviteView({ inviteId, onAccepted }: InviteViewProps) {
  const { user } = useAuthStore();
  const [inviteData, setInviteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadInvite() {
      try {
        const data = await homeService.getInviteDetails(inviteId);
        
        if (data.target_user_id && user && data.target_user_id !== user.id) {
          throw new Error('Este convite é exclusivo para outro usuário.');
        }

        let homeName = 'Casa Compartilhada';

        if (data.home_id) {
          const { data: home } = await supabase
            .from('homes')
            .select('name')
            .eq('id', data.home_id)
            .single();
          if (home?.name) homeName = home.name;
        }

        setInviteData({
          ...data,
          resolvedHomeName: homeName,
          resolvedInviterName: 'Alguém da casa'
        });
      } catch (error: any) {
        console.error("Erro ao carregar convite:", error);
        setErrorMessage(error.message || 'Convite inválido ou expirado.');
      } finally {
        setLoading(false);
      }
    }
    loadInvite();
  }, [inviteId, user]);

  const handleAccept = async () => {
    if (!user || !inviteData || processing) return;
    setProcessing(true);
    setErrorMessage('');

    try {
      await homeService.acceptInvite(inviteId, inviteData.home_id, user.id);
      onAccepted();
    } catch (error: any) {
      console.error("Erro ao aceitar convite:", error);
      setErrorMessage(error.message || 'Erro ao ingressar na residência.');
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!inviteData || processing) return;
    setProcessing(true);

    try {
      // 1. Tenta avisar o dono da casa via notificação
      if (inviteData.created_by) {
        try {
          await supabase.from('notifications').insert({
            user_id: inviteData.created_by,
            title: 'Convite Recusado',
            message: `Um usuário recusou o convite para a casa ${inviteData.resolvedHomeName}.`,
            read: false
          });
        } catch (err: any) {
          console.log('Notificação secundária ignorada:', err);
        }
      }

      // 2. Apaga o convite do banco para ele sumir definitivamente
      await supabase
        .from('home_invites')
        .delete()
        .eq('id', inviteId);

    } catch (error) {
      console.error("Erro ao recusar convite:", error);
    } finally {
      // 3. Redireciona sempre, garantindo que sai da tela de convite
      onAccepted();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-carrin-bg flex items-center justify-center p-6">
        <p className="text-gray-400 text-sm">Verificando convite...</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-carrin-bg flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-md rounded-card p-6 shadow-sm border border-gray-100 text-center space-y-4">
          <AlertCircle size={48} className="text-red-500 mx-auto" />
          <h1 className="text-xl font-bold text-carrin-dark">Acesso Indisponível</h1>
          <p className="text-sm text-gray-500">{errorMessage}</p>
          <a
            href="/"
            className="block w-full bg-carrin-dark text-white py-3 rounded-button font-bold text-sm hover:bg-gray-800 transition-all text-center"
          >
            Ir para o Início
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-carrin-bg flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-card p-6 shadow-xl border border-gray-100 space-y-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
          <HomeIcon size={32} />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-carrin-dark">Convite para Residência</h1>
          <p className="text-sm text-gray-500">
            <strong className="text-carrin-dark">{inviteData?.resolvedInviterName}</strong> convidou você para participar da casa:
          </p>
          <p className="text-lg font-bold text-emerald-600 bg-emerald-50 py-2.5 rounded-small shadow-sm">
            {inviteData?.resolvedHomeName}
          </p>
        </div>

        <div className="bg-gray-50 p-4 rounded-small text-left text-xs text-gray-600 space-y-1">
          <p className="font-bold text-gray-700">O que acontece ao aceitar?</p>
          <p>• Você terá acesso completo à lista de compras compartilhada em tempo real.</p>
          <p>• Poderá adicionar itens, executar o Modo Mercado e visualizar o histórico.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleReject}
            disabled={processing}
            className="flex-1 bg-gray-100 text-gray-600 py-3.5 rounded-button font-bold text-xs hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <X size={16} />
            <span>Recusar</span>
          </button>
          <button
            onClick={handleAccept}
            disabled={processing}
            className="flex-1 bg-emerald-600 text-white py-3.5 rounded-button font-bold text-xs shadow hover:bg-emerald-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
            <span>Aceitar</span>
          </button>
        </div>
      </div>
    </div>
  );
}