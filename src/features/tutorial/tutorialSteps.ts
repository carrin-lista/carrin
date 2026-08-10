export type TutorialStep = {
  targetId: string;
  title: string;
  desc: string;
};

export const tutorialSteps: Record<string, TutorialStep[]> = {
  list: [
    { targetId: 'nav-list', title: 'Sua lista começa aqui', desc: 'Tudo que sua Casa precisa comprar fica organizado e compartilhado neste espaço.' },
    { targetId: 'btn-add-item', title: 'Adicione o que estiver faltando', desc: 'Inclua rapidamente um produto e o Carrin ajuda a organizar sua categoria.' },
    { targetId: 'list-items-area', title: 'Tudo em um só lugar', desc: 'Aqui ficam os itens adicionados por você e pelos outros moradores da Casa.' },
    { targetId: 'search-bar', title: 'Encontre rapidinho', desc: 'Pesquise qualquer item da lista sem precisar procurar manualmente.' },
    { targetId: 'category-filter', title: 'Organizado por categoria', desc: 'O Carrin categoriza os produtos para facilitar sua compra.' },
    { targetId: 'total-pending-bar', title: 'Acompanhe sua lista', desc: 'Veja quantos itens existem e quantos ainda estão pendentes.' },
    { targetId: 'btn-market-mode', title: 'Hora das compras?', desc: 'O Modo Mercado deixa a lista pronta para você acompanhar e marcar os produtos enquanto compra.' }
  ],
  history: [
    { targetId: 'history-main-area', title: 'Suas compras ficam guardadas aqui', desc: 'Veja todas as compras anteriores, produtos comprados, valores e divida a compra entre os moradores.' }
  ],
  home: [
    {
      targetId: 'home-info-area',
      title: 'Sua Casa',
      desc: 'Aqui você acompanha o resumo da sua residência, incluindo quem é o Dono da Casa e o número de moradores.'
    },
    {
      targetId: 'tab-moradores',
      title: 'Aba de Moradores',
      desc: 'Visualize todos que dividem a lista com você. O administrador pode gerenciar e remover participantes por aqui.'
    },
    {
      targetId: 'tab-convites',
      title: 'Aba de Convites',
      desc: 'Gere links temporários ou convide pessoas diretamente pelo @username para integrarem a sua Casa.'
    },
    {
      targetId: 'tab-configuracoes',
      title: 'Aba de Configurações',
      desc: 'Altere o nome e a foto da casa, e transfira a titularidade para outro morador caso precise.'
    }
  ],
  settings: [
    { targetId: 'settings-profile-area', title: 'Seu perfil', desc: 'Atualize suas informações pessoais e preferências.' },
    { targetId: 'settings-home-area', title: 'Configurações da Casa', desc: 'Gerencie as informações e opções disponíveis para sua Casa.' }
  ]
};