import type { Node } from "../types";

/** Busca um nó pelo id (os ids são caminhos: o filho começa com o id do pai + "."). */
export function findNode(root: Node, id: string): Node | undefined {
  if (root.id === id) return root;
  for (const f of root.filhos ?? []) {
    if (id === f.id || id.startsWith(f.id + ".")) {
      const r = findNode(f, id);
      if (r) return r;
    }
  }
  return undefined;
}

/** Caminho da raiz até o nó (inclusive). Vazio se não existir. */
export function pathTo(root: Node, id: string): Node[] {
  if (root.id === id) return [root];
  for (const f of root.filhos ?? []) {
    if (id === f.id || id.startsWith(f.id + ".")) {
      const p = pathTo(f, id);
      if (p.length) return [root, ...p];
    }
  }
  return [];
}

export function parentOf(root: Node, id: string): Node | undefined {
  const p = pathTo(root, id);
  return p.length > 1 ? p[p.length - 2] : undefined;
}

/** id sem o 1º segmento (esfera): "SP.despesas.saude" -> "despesas.saude" */
export function relId(id: string): string {
  const i = id.indexOf(".");
  return i < 0 ? "" : id.slice(i + 1);
}

/** Troca a esfera do id: ("SP.despesas.saude", "estados") -> "estados.despesas.saude" */
export function withPrefix(id: string, prefixo: string): string {
  const r = relId(id);
  return r ? `${prefixo}.${r}` : prefixo;
}

export function sumChildren(n: Node): number {
  return (n.filhos ?? []).reduce((s, f) => s + f.valor, 0);
}

export function isOutros(n: Node): boolean {
  return n.id.endsWith(".outros");
}

/** Bases dos filhos diferentes da base do pai? */
export function hasMixedBases(n: Node): boolean {
  return (n.filhos ?? []).some((f) => f.base !== n.base);
}

function normaliza(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export interface SearchResult {
  /** ids dos nós cujo nome casa com a busca */
  matches: Set<string>;
  /** ids de todos os nós que devem ficar visíveis (matches + ancestrais) */
  visible: Set<string>;
}

/** Busca por nome, sem acento e sem diferenciar maiúsculas. */
export function searchTree(root: Node, query: string): SearchResult {
  const q = normaliza(query.trim());
  const matches = new Set<string>();
  const visible = new Set<string>();
  if (!q) return { matches, visible };
  const walk = (n: Node, anc: string[]) => {
    if (normaliza(n.nome).includes(q)) {
      matches.add(n.id);
      visible.add(n.id);
      anc.forEach((a) => visible.add(a));
    }
    for (const f of n.filhos ?? []) walk(f, [...anc, n.id]);
  };
  walk(root, []);
  return { matches, visible };
}

/** Lista linear dos nós visíveis (para navegação por teclado). */
export function visibleNodes(root: Node, expanded: Set<string>, filter?: Set<string>): { node: Node; level: number }[] {
  const out: { node: Node; level: number }[] = [];
  const walk = (n: Node, level: number) => {
    if (filter && filter.size && !filter.has(n.id)) return;
    out.push({ node: n, level });
    if (expanded.has(n.id)) for (const f of n.filhos ?? []) walk(f, level + 1);
  };
  walk(root, 1);
  return out;
}

function csvCell(v: string | number): string {
  const s = typeof v === "number" ? String(v).replace(".", ",") : v;
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV (separador ";", padrão de planilhas em pt-BR) do nó e dos filhos diretos. */
export function toCSV(n: Node): string {
  const linhas: (string | number)[][] = [
    ["id", "nome", "valor_R$_milhoes", "pct_do_pai", "base", "estimado", "fonte", "url"],
  ];
  const linha = (x: Node, pct: number | "") => [
    x.id,
    x.nome,
    x.valor,
    pct === "" ? "" : Math.round(pct * 100) / 100,
    x.base,
    x.estimado ? "sim" : "não",
    x.fonte.map((f) => f.nome).join(" | "),
    x.fonte.map((f) => f.url).join(" | "),
  ];
  linhas.push(linha(n, ""));
  for (const f of n.filhos ?? []) linhas.push(linha(f, n.valor ? (100 * f.valor) / n.valor : ""));
  return "﻿" + linhas.map((l) => l.map(csvCell).join(";")).join("\n");
}
