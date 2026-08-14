export interface BillingInterpretation {
  statusLabel: string;
  subtitleLabel: string;
  ctaText: string | null;
  homeTitle: string;
  homeDescription: string;
  homeCtaText: string | null;
  isSubscriptionActive: boolean;
  badgeColorClass: string;
}

export function interpretBillingState(commercialState: any, userRole: string | null): BillingInterpretation {
  const status = commercialState?.status || 'NONE';
  const trialEndsAt = commercialState?.trial_ends_at;
  const currentPeriodEnd = commercialState?.current_period_end;
  
  const now = new Date().getTime();

  // Helper para formatar data DD/MM
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  switch (status) {
    case 'INTERNAL':
      return {
        statusLabel: 'Casa interna',
        subtitleLabel: 'Acesso completo',
        ctaText: null,
        homeTitle: '',
        homeDescription: '',
        homeCtaText: null,
        isSubscriptionActive: true,
        badgeColorClass: 'text-emerald-600 font-bold'
      };

    case 'TRIAL': {
      const daysLeft = trialEndsAt ? Math.ceil((new Date(trialEndsAt).getTime() - now) / (1000 * 3600 * 24)) : 0;
      const isExpired = daysLeft <= 0;

      if (isExpired) {
        return {
          statusLabel: 'Período gratuito encerrado',
          subtitleLabel: 'Acesso expirado',
          ctaText: 'Assinar Carrin',
          homeTitle: 'Seu período gratuito terminou',
          homeDescription: 'Assine o Carrin para continuar utilizando todos os recursos da sua Casa.',
          homeCtaText: 'Assinar Carrin',
          isSubscriptionActive: false,
          badgeColorClass: 'text-rose-500 font-bold'
        };
      }

      return {
        statusLabel: 'Período gratuito',
        subtitleLabel: `${Math.max(0, daysLeft)} dias restantes`,
        ctaText: 'Assinar Carrin',
        homeTitle: '',
        homeDescription: '',
        homeCtaText: null,
        isSubscriptionActive: true,
        badgeColorClass: 'text-blue-500 font-bold'
      };
    }

    case 'LEGACY': {
      const isExpired = currentPeriodEnd ? new Date(currentPeriodEnd).getTime() < now : false;

      if (isExpired) {
        return {
          statusLabel: 'Período de transição encerrado',
          subtitleLabel: 'Acesso expirado',
          ctaText: 'Assinar Carrin',
          homeTitle: 'Seu período de transição terminou',
          homeDescription: 'Assine o Carrin para continuar utilizando todos os recursos da sua Casa.',
          homeCtaText: 'Assinar Carrin',
          isSubscriptionActive: false,
          badgeColorClass: 'text-rose-500 font-bold'
        };
      }

      return {
        statusLabel: 'Período de transição',
        subtitleLabel: `Acesso completo até ${formatDate(currentPeriodEnd)}`,
        ctaText: 'Assinar Carrin',
        homeTitle: '',
        homeDescription: '',
        homeCtaText: null,
        isSubscriptionActive: true,
        badgeColorClass: 'text-gray-500'
      };
    }

    case 'ACTIVE':
      return {
        statusLabel: 'Carrin',
        subtitleLabel: 'R$ 19/mês',
        ctaText: userRole === 'owner' ? 'Gerenciar assinatura' : 'Gerenciada pelo Dono da Casa',
        homeTitle: '',
        homeDescription: '',
        homeCtaText: null,
        isSubscriptionActive: true,
        badgeColorClass: 'text-emerald-600 font-bold'
      };

    case 'PAST_DUE':
    case 'PAYMENT_REVIEW':
      return {
        statusLabel: 'Pagamento pendente',
        subtitleLabel: 'Não conseguimos confirmar o pagamento',
        ctaText: userRole === 'owner' ? 'Regularizar pagamento' : 'Gerenciada pelo Dono da Casa',
        homeTitle: 'Pagamento pendente',
        homeDescription: 'Regularize o pagamento para voltar a utilizar todos os recursos da sua Casa.',
        homeCtaText: userRole === 'owner' ? 'Regularizar pagamento' : null,
        isSubscriptionActive: false,
        badgeColorClass: 'text-rose-500 font-bold'
      };

    case 'CANCELLED': {
      const hasAccess = currentPeriodEnd ? new Date(currentPeriodEnd).getTime() >= now : false;

      if (hasAccess) {
        return {
          statusLabel: 'Assinatura cancelada',
          subtitleLabel: `Acesso disponível até ${formatDate(currentPeriodEnd)}`,
          ctaText: userRole === 'owner' ? 'Reativar assinatura' : 'Gerenciada pelo Dono da Casa',
          homeTitle: '',
          homeDescription: '',
          homeCtaText: null,
          isSubscriptionActive: true,
          badgeColorClass: 'text-amber-500 font-bold'
        };
      }

      return {
        statusLabel: 'Assinatura inativa',
        subtitleLabel: 'Acesso encerrado',
        ctaText: userRole === 'owner' ? 'Assinar novamente' : 'Gerenciada pelo Dono da Casa',
        homeTitle: 'Assinatura encerrada',
        homeDescription: 'Assine novamente para voltar a utilizar todos os recursos da sua Casa.',
        homeCtaText: userRole === 'owner' ? 'Assinar novamente' : null,
        isSubscriptionActive: false,
        badgeColorClass: 'text-rose-500 font-bold'
      };
    }

    case 'INACTIVE':
    default:
      return {
        statusLabel: 'Sem assinatura',
        subtitleLabel: 'Carrin por R$ 19/mês',
        ctaText: userRole === 'owner' ? 'Assinar Carrin' : 'Gerenciada pelo Dono da Casa',
        homeTitle: 'Assinatura necessária',
        homeDescription: 'Assine o Carrin para voltar a utilizar todos os recursos da sua Casa.',
        homeCtaText: userRole === 'owner' ? 'Assinar Carrin' : null,
        isSubscriptionActive: false,
        badgeColorClass: 'text-gray-500'
      };
  }
}