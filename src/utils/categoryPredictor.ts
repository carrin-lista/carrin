export const normalizeForPrediction = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') 
    .replace(/[^a-z0-9\s]/g, ' ') 
    .replace(/\s+/g, ' ') 
    .trim();
};

const extractQuantity = (text: string): string | null => {
  const regex = /\b(\d+(?:[.,]\d+)?)\s*(kg|g|mg|l|ml|pct|pacote|un|cx|caixa|lata|litro|litros|garrafa)\b/i;
  const match = text.match(regex);
  return match ? match[0] : null;
};

export function analyzeItemInput(itemName: string): { category: string; extractedQuantity: string | null; normalizedName: string } {
  const extractedQuantity = extractQuantity(itemName);
  
  let textToAnalyze = itemName;
  if (extractedQuantity) {
    textToAnalyze = textToAnalyze.replace(new RegExp(extractedQuantity, 'i'), ' ');
  }
  const normalizedInput = normalizeForPrediction(textToAnalyze);

  if (!normalizedInput) {
    return { category: '🛒 Mantimentos', extractedQuantity, normalizedName: '' };
  }

  const rules = [
    { cat: '🛒 Mantimentos', matches: ['leite de coco', 'leite em po', 'leite ninho', 'bife vegetal', 'carne de soja', 'oleo', 'azeite', 'molho de tomate', 'extrato de tomate', 'creme vegetal', 'massa folhada', 'cafe', 'pao de queijo'] },
    { cat: '🥛 Laticínios', matches: ['creme de leite', 'leite condensado', 'doce de leite', 'queijo ralado'] },
    { cat: '🧴 Higiene', matches: ['crem dental', 'creme dental', 'pasta de dente', 'escova de dente', 'creme hidratante', 'papel higienico', 'fio dental', 'absorvente', 'aparelho de barbear', 'creme de barbear'] },
    { cat: '🧹 Limpeza', matches: ['sabao em po', 'sabao liquido', 'agua sanitaria', 'pano de chao', 'lixo', 'saco de lixo', 'amaciante', 'desinfetante', 'limpa vidro', 'multiuso', 'la de aco'] },
    { cat: '🥩 Açougue', matches: ['carne moida', 'peito de frango', 'carne pro churras', 'carne de panela', 'bife', 'file', 'asa', 'coxa'] },
    { cat: '🍺 Bebidas', matches: ['refri', 'refrigerante', 'coca', 'pepsi', 'guarana', 'cerveja', 'heineken', 'brahma', 'skol', 'agua', 'suco', 'vinho', 'vodka', 'gin', 'energ'] },
    { cat: '🐶 Pet', matches: ['racao', 'petisco', 'sache', 'tapete higienico', 'areia', 'gato', 'cachorro', 'whiskas', 'pedigree'] },
    { cat: '👶 Bebê', matches: ['fralda', 'lenco umedecido', 'pomada', 'pampers', 'huggies', 'nenem', 'bebe', 'leite aptamil', 'chupeta', 'mamadeira', 'bico', 'mordedor', 'babador', 'sabonete infantil', 'shampoo infantil', 'talco infantil'] },
    { cat: '🍎 Hortifrúti', matches: ['maca', 'banana', 'tomate', 'cebola', 'alface', 'batata', 'cenoura', 'limao', 'laranja', 'abacate', 'mamao', 'fruta', 'verdura', 'legume', 'alho', 'tempero', 'coentro', 'salsa', 'pimentao', 'morango', 'uva'] },
    { cat: '🥩 Açougue', matches: ['carne', 'frango', 'porco', 'peixe', 'camarao', 'costela', 'lombo', 'linguica', 'salsicha', 'bacon', 'presunto'] },
    { cat: '🥛 Laticínios', matches: ['leite', 'queijo', 'manteiga', 'requeijao', 'iogurte', 'nata', 'chantilly', 'parmesao', 'mussarela', 'mucarela', 'prato', 'provolone', 'danone', 'yakult'] },
    { cat: '🧹 Limpeza', matches: ['detergente', 'sabao', 'cloro', 'esponja', 'bombril', 'vassoura', 'rodo', 'alvejante', 'ype', 'omo', 'veja', 'cif'] },
    { cat: '🧴 Higiene', matches: ['shampoo', 'shamp', 'condicionador', 'sabonete', 'desodorante', 'gilete', 'lamina', 'cotonete', 'algodao', 'rexona', 'dove'] },
    { cat: '🏠 Utilidades', matches: ['lampada', 'pilha', 'carvao', 'fosforo', 'isqueiro', 'fita', 'papel toalha', 'guardanapo', 'vela', 'inseticida', 'baygon'] },
    { cat: '🛒 Mantimentos', matches: ['arroz', 'feijao', 'acucar', 'sal', 'macarrao', 'farinha', 'trigo', 'biscoito', 'bolacha', 'pao', 'aveia', 'milho', 'ervilha', 'atum', 'sardinha', 'granola', 'nescau', 'toddy', 'miojo', 'mistura'] }
  ];

  for (const rule of rules) {
    if (rule.matches.some(match => normalizedInput.includes(match))) {
      return { category: rule.cat, extractedQuantity, normalizedName: normalizedInput };
    }
  }

  return { category: '🛒 Mantimentos', extractedQuantity, normalizedName: normalizedInput };
}