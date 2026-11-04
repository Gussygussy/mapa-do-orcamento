import type { Base, Fonte, Node } from "../types";

/** Nó no formato compacto de public/data/municipios/<cod>.json (ver scripts/build_municipios.py). */
export interface NoCompacto {
  /** nome */
  n: string;
  /** valor em R$ milhões */
  v: number;
  /** último segmento do id */
  s: string;
  /** filhos */
  c?: NoCompacto[];
  /** estimado */
  e?: 1;
  /** nota */
  t?: string;
}

export interface MunicipioArquivo {
  cod: number;
  nome: string;
  uf: string;
  pop: number;
  fontes: { despesas: Fonte | null; receitas: Fonte | null };
  despesas: NoCompacto | null;
  receitas: NoCompacto | null;
}

/** [código IBGE, nome, UF, população, tem despesa (0/1), tem receita (0/1)] */
export type MunicipioIndice = [number, string, string, number, 0 | 1, 0 | 1];

const NOTA_OUTROS = "Diferença entre o total e a soma dos itens detalhados (calculada).";

/** Reconstrói o Node completo (id, base e fonte) a partir do formato compacto. */
export function expandir(c: NoCompacto, prefixo: string, base: Base, fonte: Fonte): Node {
  const id = `${prefixo}.${c.s}`;
  const n: Node = { id, nome: c.n, valor: c.v, base, fonte: [fonte] };
  if (c.e) n.estimado = true;
  if (c.t) n.nota = c.t;
  else if (c.s === "outros") n.nota = NOTA_OUTROS;
  if (c.c?.length) n.filhos = c.c.map((f) => expandir(f, id, base, fonte));
  return n;
}

/** Árvore de despesas ou receitas de um município; null se o município não enviou o dado. */
export function arvoreMunicipio(arq: MunicipioArquivo, modo: "despesas" | "receitas"): Node | null {
  const c = arq[modo];
  const f = arq.fontes[modo];
  if (!c || !f) return null;
  return expandir(c, `m${arq.cod}`, modo === "despesas" ? "empenhado" : "arrecadado", f);
}

/** Rótulo de busca: "Nome (UF)". */
export function rotuloMunicipio(m: MunicipioIndice): string {
  return `${m[1]} (${m[2]})`;
}
