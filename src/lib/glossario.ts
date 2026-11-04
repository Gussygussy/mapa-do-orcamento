/** Glossário embutido. Chaves em minúsculas, sem acento não é necessário (busca exata). */
export const GLOSSARIO: Record<string, { termo: string; definicao: string }> = {
  empenhado: {
    termo: "Empenhado",
    definicao:
      "Primeira fase da despesa: o governo reserva o dinheiro e se compromete a pagar. É a medida usada nas tabelas por função. Nem todo valor empenhado é pago no mesmo ano.",
  },
  liquidado: {
    termo: "Liquidado",
    definicao: "Segunda fase: o governo confirma que o bem foi entregue ou o serviço prestado. Falta só pagar.",
  },
  pago: { termo: "Pago", definicao: "Terceira fase: o dinheiro saiu efetivamente do caixa do governo." },
  caixa: {
    termo: "Regime de caixa",
    definicao:
      "Conta o que entrou ou saiu do caixa no ano, independentemente de quando a despesa foi empenhada. É o critério do Resultado do Tesouro (RTN) e do resultado do RGPS.",
  },
  arrecadado: {
    termo: "Arrecadado",
    definicao: "Receita efetivamente recebida pelo governo no ano (receita realizada).",
  },
  funcao: {
    termo: "Função e subfunção",
    definicao:
      "Classificação da despesa pela área de governo (Saúde, Educação…), comum a União, estados e municípios. Cada função se divide em subfunções (ex.: Saúde → Atenção Básica).",
  },
  encargos: {
    termo: "Encargos Especiais",
    definicao:
      "Função que não é um setor: reúne juros e amortização da dívida, transferências constitucionais a estados e municípios, precatórios e ressarcimentos.",
  },
  rgps: {
    termo: "RGPS",
    definicao:
      "Regime Geral de Previdência Social, administrado pelo INSS. Cobre trabalhadores do setor privado e servidores sem regime próprio.",
  },
  rpps: {
    termo: "RPPS",
    definicao: "Regime Próprio de Previdência Social dos servidores públicos titulares de cargo efetivo (União, estados e municípios).",
  },
  intra: {
    termo: "Despesas intraorçamentárias",
    definicao:
      "Pagamentos entre órgãos do mesmo governo (ex.: contribuição patronal ao próprio RPPS). Somá-las ao total gera dupla contagem; por isso estados e municípios aparecem sem elas.",
  },
  comprev: {
    termo: "Comprev",
    definicao: "Compensação previdenciária: acerto de contas entre o INSS e os regimes próprios pelo tempo em que o servidor contribuiu ao outro regime.",
  },
  bpc: {
    termo: "BPC",
    definicao:
      "Benefício de Prestação Continuada: um salário mínimo mensal a idosos de 65 anos ou mais e a pessoas com deficiência de baixa renda. É assistência, não previdência.",
  },
  rtn: {
    termo: "RTN",
    definicao: "Resultado do Tesouro Nacional: relatório mensal com receitas e despesas primárias do Governo Central pelo regime de caixa.",
  },
  rreo: {
    termo: "RREO",
    definicao:
      "Relatório Resumido da Execução Orçamentária, publicado a cada dois meses por todos os entes (Lei de Responsabilidade Fiscal). O 6º bimestre traz o ano fechado.",
  },
  dca: {
    termo: "DCA",
    definicao: "Declaração de Contas Anuais que cada ente envia ao Tesouro pelo Siconfi, com o balanço do ano.",
  },
  rcl: {
    termo: "Receita corrente líquida (RCL)",
    definicao: "Receitas correntes menos transferências obrigatórias (a municípios, Fundeb) e contribuições previdenciárias dos servidores. Serve de base para limites da LRF.",
  },
  fundeb: {
    termo: "Fundeb",
    definicao: "Fundo de Manutenção e Desenvolvimento da Educação Básica. Recebe parte dos impostos de estados e municípios e redistribui conforme o número de alunos.",
  },
  estimativa: {
    termo: "Estimativa",
    definicao: "Valor calculado (por exemplo, a diferença entre um total e a soma das partes), e não lido diretamente de uma fonte oficial.",
  },
};

export type TermoGlossario = keyof typeof GLOSSARIO;
