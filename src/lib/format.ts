/** Formatação pt-BR. Valores monetários de entrada estão em R$ milhões. */

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: min, maximumFractionDigits: max });

const nf0 = nf(0, 0);
const nf1 = nf(1, 1);
const nf2 = nf(2, 2);

const MENOS = "−"; // sinal de menos tipográfico

/** "R$ 1,10 tri", "R$ 240,2 bi", "R$ 850 mi", "R$ 3,5 mi", "R$ 120 mil" */
export function formatBRL(milhoes: number): string {
  if (!Number.isFinite(milhoes)) return "dado não disponível";
  const sinal = milhoes < 0 ? MENOS : "";
  const v = Math.abs(milhoes);
  let txt: string;
  if (v >= 1e6) txt = `${nf2.format(v / 1e6)} tri`;
  else if (v >= 1e3) txt = `${nf1.format(v / 1e3)} bi`;
  else if (v >= 10) txt = `${nf0.format(v)} mi`;
  else if (v >= 1) txt = `${nf1.format(v)} mi`;
  else if (v > 0) txt = `${nf0.format(v * 1e3)} mil`;
  else txt = "0";
  return `${sinal}R$ ${txt}`;
}

/** Valor em reais (não milhões), ex.: per capita: "R$ 5.123" */
export function formatReais(reais: number): string {
  if (!Number.isFinite(reais)) return "dado não disponível";
  const sinal = reais < 0 ? MENOS : "";
  const v = Math.abs(reais);
  return `${sinal}R$ ${v >= 100 ? nf0.format(v) : nf2.format(v)}`;
}

/** 12.3456 -> "12,3%"; valores pequenos ganham mais casas */
export function formatPct(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  const sinal = pct < 0 ? MENOS : "";
  const v = Math.abs(pct);
  const txt = v === 0 ? "0" : v < 0.1 ? nf(2, 2).format(v) : v < 10 ? nf1.format(v) : nf1.format(v);
  return `${sinal}${txt}%`;
}

export function formatInt(n: number): string {
  return Number.isFinite(n) ? nf0.format(n) : "—";
}

export function formatNumero(n: number, casas = 1): string {
  return Number.isFinite(n) ? nf(0, casas).format(n) : "—";
}

/** Formata um indicador conforme a unidade declarada. */
export function formatIndicador(valor: number, unidade: string): string {
  if (unidade === "R$ mi") return formatBRL(valor);
  if (unidade === "%") return formatPct(valor);
  if (unidade === "R$") return formatReais(valor);
  return `${formatInt(valor)} ${unidade}`;
}
