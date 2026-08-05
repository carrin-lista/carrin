export function predictCategory(itemName: string): string {
  const name = itemName.toLowerCase().trim();

  // Dicionário de palavras-chave por categoria
  const keywords: { [key: string]: string[] } = {
    '🍎 Hortifrúti': [
      'maçã', 'banana', 'tomate', 'cebola', 'alface', 'batata', 'cenoura', 
      'limão', 'laranja', 'abacate', 'mamão', 'fruta', 'verdura', 'legume', 
      'alho', 'tempero verde', 'coentro', 'salsinha', 'pimentão', 'morango'
    ],
    '🥩 Açougue': [
      'carne', 'frango', 'peito de frango', 'carne moída', 'patinho', 'alcatra', 
      'bife', 'linguiça', 'porco', 'bacon', 'salsicha', 'presunto', 'peixe', 
      'camarão', 'costela', 'lombo', 'frango a passarinho'
    ],
    '🥛 Laticínios': [
      'leite', 'queijo', 'manteiga', 'requeijão', 'iogurte', 'creme de leite', 
      'leite condensado', 'nata', 'chantilly', 'massa folhada', 'parmesão', 'mussarela'
    ],
    '🧹 Limpeza': [
      'detergente', 'sabão', 'amaciante', 'cloro', 'água sanitária', 'desinfetante', 
      'esponja', 'lã de aço', 'bombril', 'vassoura', 'rodo', 'pano de chão', 
      'limpa vidro', 'multiuso', 'saco de lixo', 'alvejante', 'sabão em pó'
    ],
    '🧴 Higiene': [
      'papel higiênico', 'pasta de dente', 'escova de dente', 'shampoo', 
      'condicionador', 'sabonete', 'desodorante', 'fio dental', 'absorvente', 
      'gilete', 'lâmina', 'creme de barbear', 'cotonete', 'algodão'
    ],
    '🛒 Mantimentos': [
      'arroz', 'feijão', 'açúcar', 'sal', 'óleo', 'café', 'macarrão', 'farinha', 
      'trigo', 'molho de tomate', 'azeite', 'biscoito', 'bolacha', 'pão', 
      'aveia', 'milho', 'ervilha', 'atum', 'sardinha', 'granola', 'leite em pó'
    ]
  };

  // Procura se alguma palavra-chave está contida no nome digitado
  for (const [category, words] of Object.entries(keywords)) {
    for (const word of words) {
      if (name.includes(word)) {
        return category;
      }
    }
  }

  // Se não encontrar nenhuma correspondência, retorna Mantimentos ou Outros como padrão
  return '🛒 Mantimentos';
}