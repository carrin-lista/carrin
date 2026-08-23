import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { supabase } from '../../services/supabase';
import { ChevronLeft, CreditCard, Lock, Check, AlertCircle, Tag, X } from 'lucide-react';

export function Checkout({ onBack }: { onBack: () => void }) {
  const { user, homeId } = useAuthStore();
  
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingOffer, setPendingOffer] = useState<any>(null);

  // 🚀 MARKETING: Estados do Cupom
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cpf, setCpf] = useState('');
  const [cep, setCep] = useState('');
  const [addressNumber, setAddressNumber] = useState('');

  useEffect(() => {
    async function fetchOffer() {
      if (!homeId) return;
      try {
        const { data } = await supabase.from('custom_offers').select('*').eq('home_id', homeId).eq('status', 'PENDING').single();
        if (data) setPendingOffer(data);
      } catch (error) {}
    }
    fetchOffer();
  }, [homeId]);

  // 🚀 MARKETING: Tenta aplicar o cupom do parceiro automaticamente se houver indicação
  useEffect(() => {
    async function autoApplyCoupon() {
      if (!user || pendingOffer) return;
      try {
        const { data } = await supabase.rpc('get_user_referral_coupon');
        if (data && data.valid) setAppliedCoupon(data);
      } catch (err) {}
    }
    autoApplyCoupon();
  }, [user, pendingOffer]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleCardNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim();
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

  // 🚀 MARKETING: Validação Manual do Cupom no Banco
  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setValidatingCoupon(true);
    try {
      const { data, error } = await supabase.rpc('validate_marketing_coupon', { p_code: couponInput.trim() });
      if (error) throw error;
      
      if (!data.valid) {
        showFeedback('error', data.error || 'Cupom inválido.');
        setAppliedCoupon(null);
      } else {
        setAppliedCoupon(data);
        setCouponInput('');
        showFeedback('success', `Cupom ${data.code} aplicado com sucesso!`);
      }
    } catch (err) {
      showFeedback('error', 'Erro ao validar cupom.');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !homeId) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada.");

      const [expMonth, expYearRaw] = expiry.split('/');
      const expYear = expYearRaw.length === 2 ? `20${expYearRaw}` : expYearRaw;
      const { data: profile } = await supabase.from('users').select('phone').eq('id', user.id).single();

      // 🚀 MARKETING: O Código do Cupom vai injetado no Payload para a Edge Function processar!
      const payload = {
        home_id: homeId,
        offer_id: pendingOffer ? pendingOffer.id : null,
        coupon_code: appliedCoupon ? appliedCoupon.code : null,
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
      if (!response.ok) throw new Error(result.error || "Erro ao processar pagamento.");

      showFeedback('success', 'Pagamento em processamento! Seu acesso será liberado em instantes.');
      setTimeout(() => onBack(), 2000);

    } catch (error: any) {
      console.error(error);
      showFeedback('error', error.message || 'Falha na comunicação com o banco.');
    } finally {
      setLoading(false);
    }
  };

  // 🚀 MARKETING: Cálculo de Preços Visual no Frontend
  const basePrice = 19.00;
  let finalPrice = basePrice;
  let planSubtitleDisplay = 'R$ 19,00 / mês • Cancele quando quiser';
  let planPriceDisplay = 'R$ 19,00';

  if (pendingOffer) {
    finalPrice = pendingOffer.new_price;
    planPriceDisplay = `R$ ${finalPrice.toFixed(2).replace('.', ',')}`;
    planSubtitleDisplay = `${planPriceDisplay} / mês • Plano Customizado (${pendingOffer.new_limit} moradores)`;
  } else if (appliedCoupon) {
    if (appliedCoupon.discount_type === 'percentage') {
      finalPrice = basePrice * (1 - appliedCoupon.discount_value / 100);
    } else {
      finalPrice = Math.max(0, basePrice - appliedCoupon.discount_value);
    }
    planPriceDisplay = `R$ ${finalPrice.toFixed(2).replace('.', ',')}`;
    planSubtitleDisplay = appliedCoupon.first_charge_only 
      ? `Primeira mensalidade: ${planPriceDisplay} (Depois R$ 19,00/mês)` 
      : `${planPriceDisplay} / mês com desconto aplicado`;
  }

  return (
    <div className="min-h-screen bg-carrin-bg p-6 pb-32 max-w-lg mx-auto space-y-6 relative animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {feedback && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-card shadow-lg text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200 whitespace-nowrap w-max max-w-[95vw] overflow-hidden ${feedback.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {feedback.type === 'success' ? <Check size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
          <span className="truncate">{feedback.text}</span>
        </div>
      )}

      {pendingOffer && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-card flex items-center gap-3">
          <Tag className="text-emerald-600 shrink-0" size={24} />
          <div>
            <p className="text-xs font-bold text-emerald-900 uppercase">Oferta Especial Disponível!</p>
            <p className="text-sm text-emerald-700 font-medium">Sua casa foi liberada para até {pendingOffer.new_limit} moradores por apenas {planPriceDisplay}/mês.</p>
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
        
        <div className="bg-white rounded-card p-5 shadow-sm space-y-4 border border-gray-100">
          <div className="flex items-center gap-2 text-carrin-dark font-semibold pb-2 border-b border-gray-50">
            <CreditCard size={18} className="text-emerald-600" />
            <span>Dados do Cartão</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">Número do Cartão</label>
              <input type="text" required value={cardNumber} onChange={handleCardNumber} placeholder="0000 0000 0000 0000" maxLength={19} className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2.5 text-sm font-bold text-carrin-dark outline-none focus:border-emerald-600" />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">Nome Impresso no Cartão</label>
              <input type="text" required value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())} placeholder="NOME DO TITULAR" className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2.5 text-sm font-medium text-carrin-dark outline-none focus:border-emerald-600 uppercase" />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">Validade</label>
                <input type="text" required value={expiry} onChange={handleExpiry} placeholder="MM/AAAA" maxLength={7} className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2.5 text-sm font-medium text-carrin-dark outline-none focus:border-emerald-600" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">CVC</label>
                <input type="text" required value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').substring(0, 4))} placeholder="123" maxLength={4} className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2.5 text-sm font-medium text-carrin-dark outline-none focus:border-emerald-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-card p-5 shadow-sm space-y-4 border border-gray-100">
          <div className="flex items-center gap-2 text-carrin-dark font-semibold pb-2 border-b border-gray-50">
            <Lock size={18} className="text-gray-400" />
            <span>Dados do Titular da Fatura</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">CPF do Titular</label>
              <input type="text" required value={cpf} onChange={handleCpf} placeholder="000.000.000-00" maxLength={14} className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2.5 text-sm font-medium text-carrin-dark outline-none focus:border-emerald-600" />
            </div>

            <div className="flex gap-3">
              <div className="flex-[2]">
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">CEP</label>
                <input type="text" required value={cep} onChange={handleCep} placeholder="00000-000" maxLength={9} className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2.5 text-sm font-medium text-carrin-dark outline-none focus:border-emerald-600" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 block">Número</label>
                <input type="text" required value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} placeholder="123" className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2.5 text-sm font-medium text-carrin-dark outline-none focus:border-emerald-600" />
              </div>
            </div>
          </div>
        </div>

        {/* 🚀 MARKETING: Bloco do Cupom */}
        {!pendingOffer && (
          <div className="bg-white rounded-card p-4 shadow-sm border border-gray-100 space-y-3">
            {appliedCoupon ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-3 rounded-small">
                <div className="flex items-center gap-2">
                  <Tag size={16} className="text-emerald-600" />
                  <div>
                    <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">{appliedCoupon.code} aplicado</p>
                    <p className="text-[10px] text-emerald-600 font-medium">
                      {appliedCoupon.discount_type === 'percentage' ? `${appliedCoupon.discount_value}% de desconto na primeira fatura` : `R$ ${appliedCoupon.discount_value.toFixed(2)} de desconto na primeira fatura`}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setAppliedCoupon(null)} className="text-emerald-700 hover:text-emerald-900 bg-emerald-100 p-1.5 rounded-full transition-colors">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div>
                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-2 block">Possui um cupom?</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={couponInput} 
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Digite seu cupom"
                    className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2.5 text-sm font-bold text-carrin-dark outline-none focus:border-emerald-600 uppercase"
                  />
                  <button 
                    type="button" 
                    onClick={handleApplyCoupon}
                    disabled={validatingCoupon || !couponInput.trim()}
                    className="bg-gray-800 text-white px-4 py-2 rounded text-sm font-bold disabled:opacity-50 hover:bg-black transition-colors shrink-0"
                  >
                    {validatingCoupon ? '...' : 'Aplicar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <button type="submit" disabled={loading} className="w-full bg-emerald-600 text-white py-3.5 rounded-card font-bold text-sm hover:bg-emerald-700 transition-colors shadow-sm mt-4 flex justify-center items-center gap-2 disabled:opacity-50">
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