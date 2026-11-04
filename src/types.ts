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
  unidade: string;
  fonte: Fonte;
}

export interface Node {
  /** caminho estável: "uniao.despesas.previdencia.rgps.rural" */
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
  /** ex.: beneficiarios, deficit, receita_propria, var_real_2024 */
  indicadores?: Record<string, Indicador>;
  /** histórico, se houver */
  serie?: { ano: number; valor: number }[];
  filhos?: Node[];
}

export type Modo = "despesas" | "receitas" | "saldo";
export type Esfera = "uniao" | "estados" | "estado" | "comparar";
export type Unidade = "reais" | "pct_total" | "pct_pib" | "per_capita";
export type Tema = "claro" | "escuro";
