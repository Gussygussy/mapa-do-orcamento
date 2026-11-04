export type Base = "empenhado" | "liquidado" | "pago" | "caixa" | "arrecadado";

export interface Fonte {
  /** ex.: "Boletim CONORF fev/2026 – Senado" */
  nome: string;
  url: string;
  /** ex.: "Tabela 10 – Execução por função" */
  tabela?: string;
}

export interface Indicador {
  valor: number;
  /** "R$ mi", "%", "benefícios", "municípios"… */
  unidade: string;
  fonte: Fonte;
  nota?: string;
  estimado?: boolean;
}

export interface Node {
  /** caminho estável: "uniao.despesas.previdencia_social.previdencia_basica.rural" */
  id: string;
  nome: string;
  /** em R$ milhões */
  valor: number;
  base: Base;
  /** "nominal" (padrão) ou "dez/2025 IPCA" */
  precos?: string;
  estimado?: boolean;
  /** explicação curta exibida no painel */
  nota?: string;
  fonte: Fonte[];
  /** ex.: beneficiarios, deficit, receita_propria */
  indicadores?: Record<string, Indicador>;
  /** histórico, se houver */
  serie?: { ano: number; valor: number }[];
  filhos?: Node[];
}

export interface UfArquivo {
  uf: string;
  nome: string;
  cod_ibge: number;
  despesas: Node;
  receitas: Node;
}

export interface SaldoItem {
  id: string;
  nome: string;
  receita: number;
  despesa: number;
  saldo: number;
  base: Base;
  fonte: Fonte[];
  /** id do nó relacionado na árvore de despesas, se houver */
  no?: string;
  nota?: string;
}

export type SaldoArquivo = Record<string, SaldoItem[]>;

/** valor de cada nó (id sem o 1º segmento) em cada UF: governo estadual e soma dos municípios */
export type CompararArquivo = Record<
  "despesas" | "receitas" | "municipios_despesas" | "municipios_receitas",
  Record<string, Record<string, number>>
>;

export interface Meta {
  atualizado_em: string;
  exercicio: number;
  pib: { valor: number; unidade: string; fonte: Fonte; nota: string };
  populacao: { brasil: number; uf: Record<string, number>; fonte: Fonte };
  ufs: { sigla: string; nome: string; cod_ibge: number }[];
  municipios: {
    entes_total: number;
    despesas_com_dados: number;
    despesas_pct_populacao: number;
    receitas_com_dados: number;
    receitas_pct_populacao: number;
  };
}

export type Modo = "despesas" | "receitas" | "saldo";
/** uniao | estados (agregado) | estado (UF específica) | municipios (agregado) | comparar */
export type Esfera = "uniao" | "estados" | "estado" | "municipios" | "comparar";
export type Unidade = "reais" | "pct_total" | "pct_pib" | "per_capita";
export type Visualizacao = "treemap" | "sunburst" | "barras";
export type Tema = "claro" | "escuro";
