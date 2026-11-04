import type { Unidade } from "../types";
import { formatBRL, formatPct, formatReais } from "./format";

export interface UnitCtx {
  unidade: Unidade;
  /** valor da raiz da árvore atual (R$ mi), base do "% do total" */
  total: number;
  /** PIB nominal 2025 (R$ mi) */
  pib: number;
  /** população de referência (pessoas) */
  pop: number;
}

export const UNIDADE_LABEL: Record<Unidade, string> = {
  reais: "R$",
  pct_total: "% do total",
  pct_pib: "% do PIB",
  per_capita: "per capita",
};

/** Converte um valor em R$ mi para a unidade escolhida. */
export function metric(valorMi: number, ctx: UnitCtx): number {
  switch (ctx.unidade) {
    case "reais":
      return valorMi;
    case "pct_total":
      return ctx.total ? (100 * valorMi) / ctx.total : NaN;
    case "pct_pib":
      return ctx.pib ? (100 * valorMi) / ctx.pib : NaN;
    case "per_capita":
      return ctx.pop ? (valorMi * 1e6) / ctx.pop : NaN;
  }
}

export function formatMetric(valorMi: number, ctx: UnitCtx): string {
  const v = metric(valorMi, ctx);
  if (!Number.isFinite(v)) return "dado não disponível";
  switch (ctx.unidade) {
    case "reais":
      return formatBRL(v);
    case "pct_total":
    case "pct_pib":
      return formatPct(v);
    case "per_capita":
      return `${formatReais(v)}/hab.`;
  }
}
