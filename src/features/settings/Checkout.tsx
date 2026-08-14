import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { supabase } from '../../services/supabase';
import { ChevronLeft, CreditCard, Lock, Check, AlertCircle, Tag } from 'lucide-react';

export function Checkout({ onBack }: { onBack: () => void }) {
  const { user, homeId } = useAuthStore();
  
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estado para guardar a oferta customizada pendente, se houver
  const [pendingOffer, setPendingOffer] = useState<any>(null);

  // Estados do formulário
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cpf, setCpf] = useState('');
  const [cep, setCep] = useState('');
  const [addressNumber, setAddressNumber] = useState('');

  // Busca se existe oferta customizada pendente para esta casa ao abrir a tela
  useEffect(() => {
    async function fetchOffer() {
      if (!homeId) return;
      try {
        const { data } = await supabase
          .from('custom_offers')
          .select('*')
          .eq('home_id', homeId)
          .eq('status', 'PENDING')
          .single();
        
        if (data) {
          setPendingOffer(data);
        }
      } catch (error) {
        // Sem ofertas customizadas pendentes, segue o fluxo normal padrão
      }
    }
    fetchOffer();
  }, [homeId]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Máscaras simples
  const handleCardNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    value = value.replace(/(\d{4})/g, '$1 ').trim();
    setCardNumber(value.substring(0, 19));
  };

  const handleExpiry = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 2) value = `${value.substring(0, 2)}/${value.substring(2, 6)}`;
    setExpiry(value.substring(0, 7));
  };

  const handleCpf = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.substring(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    setCpf(value);
  };

  const handleCep = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.substring(0, 8);
    value = value.replace(/(\d{5})(\d)/, '$1-$2');
    setCep(value);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !homeId) return;

    setLoading(true);
    try {
      // 1. Pega a sessão atual para o JWT
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada.");

      // 2. Prepara os dados de validade (Trata formatos MM/AA e MM/AAAA)
      const [expMonth, expYearRaw] = expiry.split('/');
      const expYear = expYearRaw.length === 2 ? `20${expYearRaw}` : expYearRaw;

      // 3. Busca o telefone do usuário no profile (opcional)
      const { data: profile } = await supabase.from('users').select('phone').eq('id', user.id).single();

      // 4. Monta o Payload incluindo o offer_id caso haja oferta customizada válida
      const payload = {
        home_id: homeId,
        offer_id: pendingOffer ? pendingOffer.id : null,
        creditCard: {
          holderName: cardName.trim(),
          number: cardNumber.replace(/\D/g, ''),
          expiryMonth: expMonth,
          expiryYear: expYear,
          ccv: cvc
        },
        creditCardHolderInfo: {
          name: cardName.trim(),
          email: user.email,
          cpfCnpj: cpf.replace(/\D/g, ''),
          postalCode: cep.replace(/\D/g, ''),
          addressNumber: addressNumber.trim(),
          phone: profile?.phone || ''
        }
      };

      // 5. Envia para a Edge Function de forma segura (HTTPS)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''; 
      const response = await fetch(`${supabaseUrl}/functions/v1/asaas-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao processar pagamento.");
      }

      showFeedback('success', 'Pagamento em processamento! Seu acesso será liberado em instantes.');
      
      // Retorna para a tela de ajustes após 2 segundos
      setTimeout(() => {
        onBack();
      }, 2000);

    } catch (error: any) {
      console.error(error);
      showFeedback('error', error.message || 'Falha na comunicação com o banco.');
    } finally {
      setLoading(false);
    }
  };

  const planPriceDisplay = pendingOffer ? `R$ ${pendingOffer.new_price.toFixed(2)}` : 'R$ 19,00';
  const planSubtitleDisplay = pendingOffer 
    ? `${planPriceDisplay} / mês • Plano Customizado (${pendingOffer.new_limit} moradores)` 
    : 'R$ 19,00 / mês • Cancele quando quiser';

  return (
    <div className="min-h-screen bg-carrin-bg p-6 pb-32 max-w-lg mx-auto space-y-6 relative animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {feedback && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-card shadow-lg text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200 whitespace-nowrap w-max max-w-[95vw] overflow-hidden ${feedback.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {feedback.type === 'success' ? <Check size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
          <span className="truncate">{feedback.text}</span>
        </div>
      )}

      {/* Banner de Oferta Customizada, se houver */}
      {pendingOffer && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-card flex items-center gap-3">
          <Tag className="text-emerald-600 shrink-0" size={24} />
          <div>
            <p className="text-xs font-bold text-emerald-900 uppercase">Oferta Especial Disponível!</p>
            <p className="text-sm text-emerald-700 font-medium">
              Sua casa foi liberada para até {pendingOffer.new_limit} moradores por apenas {planPriceDisplay}/mês.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 bg-white rounded-full shadow-sm text-gray-500 hover:text-carrin-dark">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-carrin-dark mb-0.5">Assinar Carrin</h1>
          <p className="text-gray-500 text-xs">{planSubtitleDisplay}</p>
        </div>
      </div>

      <form onSubmit={handleCheckout} className="space-y-4">
        
        {/* DADOS DO CARTÃO */}
        <div className="bg-white rounded-card p-5 shadow-sm space-y-4 border border-gray-100">
          <div className="flex items-center gap-2 text-carrin-dark font-semibold pb-2 border-b border-gray-50">
            <CreditCard size={18} className="text-emerald-600" />
            <span>Dados do Cartão</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">Número do Cartão</label>
              <input 
                type="text" required
                value={cardNumber} onChange={handleCardNumber}
                placeholder="0000 0000 0000 0000"
                maxLength={19}
                className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2.5 text-sm font-bold text-carrin-dark outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">Nome Impresso no Cartão</label>
              <input 
                type="text" required
                value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())}
                placeholder="NOME DO TITULAR"
                className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2.5 text-sm font-medium text-carrin-dark outline-none focus:border-emerald-600 uppercase"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">Validade</label>
                <input 
                  type="text" required
                  value={expiry} onChange={handleExpiry}
                  placeholder="MM/AAAA"
                  maxLength={7}
                  className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2.5 text-sm font-medium text-carrin-dark outline-none focus:border-emerald-600"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">CVC</label>
                <input 
                  type="text" required
                  value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').substring(0, 4))}
                  placeholder="123"
                  maxLength={4}
                  className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2.5 text-sm font-medium text-carrin-dark outline-none focus:border-emerald-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* DADOS DO TITULAR */}
        <div className="bg-white rounded-card p-5 shadow-sm space-y-4 border border-gray-100">
          <div className="flex items-center gap-2 text-carrin-dark font-semibold pb-2 border-b border-gray-50">
            <Lock size={18} className="text-gray-400" />
            <span>Dados do Titular da Fatura</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">CPF do Titular</label>
              <input 
                type="text" required
                value={cpf} onChange={handleCpf}
                placeholder="000.000.000-00"
                maxLength={14}
                className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2.5 text-sm font-medium text-carrin-dark outline-none focus:border-emerald-600"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-[2]">
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">CEP</label>
                <input 
                  type="text" required
                  value={cep} onChange={handleCep}
                  placeholder="00000-000"
                  maxLength={9}
                  className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2.5 text-sm font-medium text-carrin-dark outline-none focus:border-emerald-600"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">Número</label>
                <input 
                  type="text" required
                  value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)}
                  placeholder="123"
                  className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2.5 text-sm font-medium text-carrin-dark outline-none focus:border-emerald-600"
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 text-white py-3.5 rounded-card font-bold text-sm hover:bg-emerald-700 transition-colors shadow-sm mt-4 flex justify-center items-center gap-2 disabled:opacity-50"
        >
          {loading ? 'Processando pagamento seguro...' : `Confirmar Assinatura (${planPriceDisplay}/mês)`}
        </button>
        
        <div className="flex justify-center items-center gap-1.5 mt-2 opacity-50">
          <Lock size={12} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Pagamento Seguro Criptografado</span>
        </div>

      </form>
    </div>
  );
}