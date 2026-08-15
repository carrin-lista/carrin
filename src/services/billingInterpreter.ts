export interface CommercialContext {
  status: string;
  can_write: boolean;
  reason: string;
  current_period_end?: string;
  trial_ends_at?: string;
  grace_period_ends_at?: string;
  effective_limit?: number;
}

export interface BillingInterpretation {
  statusLabel: string;
  subtitleLabel: string;
  ctaText: string | null;
  homeTitle: string;
  homeDescription: string;
  homeCtaText: string | null;
  isSubscriptionActive: boolean;
  badgeColorClass: string;
  blockMessage: string;
}

export function interpretBillingState(context: CommercialContext | null, userRole: string | null): BillingInterpretation {
  if (!context) {
    return {
      statusLabel: 'Sem assinatura',
      subtitleLabel: 'Verificando...',
      ctaText: null,
      homeTitle: 'Verificando',
      homeDescription: 'Carregando o estado da sua assinatura...',
      homeCtaText: null,
      isSubscriptionActive: false,
      badgeColorClass: 'text-gray-500',
      blockMessage: 'Verificando acesso...'
    };
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const isOwner = userRole === 'owner';
  const ownerLabel = 'Gerenciada pelo Dono da Casa';

  // 1. SE POSSUI PERMISSÃO DE ESCRITA, O ESTADO COMERCIAL ESTÁ EM DIA
  if (context.can_write) {
    if (context.status === 'INTERNAL') {
      return { statusLabel: 'Casa interna', subtitleLabel: 'Acesso gratuito', ctaText: null, homeTitle: '', homeDescription: '', homeCtaText: null, isSubscriptionActive: true, badgeColorClass: 'text-emerald-600 font-bold', blockMessage: '' };
    }
    if (context.status === 'TRIAL') {
      return { statusLabel: 'Período gratuito', subtitleLabel: `Válido até ${formatDate(context.trial_ends_at)}`, ctaText: isOwner ? 'Assinar Carrin' : ownerLabel, homeTitle: '', homeDescription: '', homeCtaText: null, isSubscriptionActive: true, badgeColorClass: 'text-blue-500 font-bold', blockMessage: '' };
    }
    if (context.status === 'LEGACY') {
      return { statusLabel: 'Período de transição', subtitleLabel: 'Acesso completo', ctaText: isOwner ? 'Assinar Carrin' : ownerLabel, homeTitle: '', homeDescription: '', homeCtaText: null, isSubscriptionActive: true, badgeColorClass: 'text-gray-500 font-bold', blockMessage: '' };
    }
    if (context.status === 'PAST_DUE') {
      return { statusLabel: 'Pagamento pendente', subtitleLabel: `Cortesia até ${formatDate(context.grace_period_ends_at)}`, ctaText: isOwner ? 'Regularizar' : ownerLabel, homeTitle: '', homeDescription: '', homeCtaText: null, isSubscriptionActive: true, badgeColorClass: 'text-amber-500 font-bold', blockMessage: '' };
    }
    if (context.status === 'CANCELLED') {
      return { statusLabel: 'Assinatura cancelada', subtitleLabel: `Acesso até ${formatDate(context.current_period_end)}`, ctaText: isOwner ? 'Reativar' : ownerLabel, homeTitle: '', homeDescription: '', homeCtaText: null, isSubscriptionActive: true, badgeColorClass: 'text-amber-500 font-bold', blockMessage: '' };
    }
    
    // Status 'ACTIVE'
    return { statusLabel: 'Carrin', subtitleLabel: 'R$ 19/mês', ctaText: isOwner ? 'Gerenciar assinatura' : ownerLabel, homeTitle: '', homeDescription: '', homeCtaText: null, isSubscriptionActive: true, badgeColorClass: 'text-emerald-600 font-bold', blockMessage: '' };
  }

  // 2. SE O ACESSO FOI SUSPENSO PELO BANCO, MAPEAMOS O MOTIVO EXATO
  switch (context.reason) {
    case 'TRIAL_EXPIRED':
      return { statusLabel: 'Período gratuito encerrado', subtitleLabel: 'Acesso suspenso', ctaText: isOwner ? 'Assinar Carrin' : ownerLabel, homeTitle: 'Seu período terminou', homeDescription: 'Assine o Carrin para continuar adicionando itens.', homeCtaText: isOwner ? 'Assinar Carrin' : null, isSubscriptionActive: false, badgeColorClass: 'text-rose-500 font-bold', blockMessage: 'Seu período gratuito terminou. Assine o Carrin para voltar a adicionar itens na lista.' };
    
    case 'PERIOD_EXPIRED':
      return { statusLabel: 'Assinatura expirada', subtitleLabel: 'Acesso suspenso', ctaText: isOwner ? 'Regularizar' : ownerLabel, homeTitle: 'Assinatura encerrada', homeDescription: 'Reative para continuar usando todos os recursos.', homeCtaText: isOwner ? 'Regularizar' : null, isSubscriptionActive: false, badgeColorClass: 'text-rose-500 font-bold', blockMessage: 'Sua assinatura expirou. Regularize o acesso para voltar a adicionar itens.' };
    
    case 'PAST_DUE':
      return { statusLabel: 'Pagamento pendente', subtitleLabel: 'Acesso suspenso', ctaText: isOwner ? 'Regularizar pagamento' : ownerLabel, homeTitle: 'Pagamento pendente', homeDescription: 'Regularize o pagamento para voltar a utilizar a Casa.', homeCtaText: isOwner ? 'Regularizar' : null, isSubscriptionActive: false, badgeColorClass: 'text-rose-500 font-bold', blockMessage: 'Identificamos um pagamento pendente em atraso. Regularize a situação para voltar a usar a lista.' };
    
    case 'PAYMENT_REVIEW':
      return { statusLabel: 'Pagamento em análise', subtitleLabel: 'Aguardando compensação', ctaText: null, homeTitle: 'Pagamento em análise', homeDescription: 'Aguardando a confirmação do banco.', homeCtaText: null, isSubscriptionActive: false, badgeColorClass: 'text-blue-500 font-bold', blockMessage: 'Seu pagamento está em análise. Assim que for confirmado, o acesso será liberado automaticamente.' };
    
    case 'INACTIVE':
    default:
      return { statusLabel: 'Sem assinatura', subtitleLabel: 'Acesso suspenso', ctaText: isOwner ? 'Assinar Carrin' : ownerLabel, homeTitle: 'Assinatura necessária', homeDescription: 'Assine o Carrin para voltar a utilizar a Casa.', homeCtaText: isOwner ? 'Assinar Carrin' : null, isSubscriptionActive: false, badgeColorClass: 'text-gray-500 font-bold', blockMessage: isOwner ? 'O período de uso da sua Casa expirou. Assine o Carrin para voltar a adicionar itens.' : 'O plano da sua Casa expirou. Peça ao Dono para regularizar a assinatura.' };
  }
}