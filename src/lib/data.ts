import { useEffect, useState } from "react";
import type { CompararArquivo, Esfera, Meta, Modo, Node, SaldoArquivo, UfArquivo } from "../types";
import { treeModo } from "../store/useApp";

const cache = new Map<string, Promise<unknown>>();

/** Carrega um JSON estático de public/data (com cache em memória). */
export function loadJson<T>(path: string): Promise<T> {
  let p = cache.get(path);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/${path}`).then((r) => {
      if (!r.ok) throw new Error(`Falha ao carregar ${path} (${r.status})`);
      return r.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p as Promise<T>;
}

export interface Loadable<T> {
  data?: T;
  error?: string;
  loading: boolean;
}

export function useJson<T>(path: string | null): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ loading: !!path });
  useEffect(() => {
    if (!path) {
      setState({ loading: false });
      return;
    }
    let vivo = true;
    setState((s) => ({ data: s.data, loading: true }));
    loadJson<T>(path)
      .then((data) => vivo && setState({ data, loading: false }))
      .catch((e: Error) => vivo && setState({ error: e.message, loading: false }));
    return () => {
      vivo = false;
    };
  }, [path]);
  return state;
}

/** Arquivo e chave da árvore para a combinação esfera/UF/modo. null = dado não disponível. */
export function treeSource(esfera: Esfera, uf: string, modo: Modo): { path: string; key?: "despesas" | "receitas" } | null {
  const m = treeModo(modo);
  switch (esfera) {
    case "uniao":
      return { path: `uniao_${m}.json` };
    case "estados":
    case "comparar":
      return { path: `estados_${m}.json` };
    case "estado":
      return { path: `estados/${uf}.json`, key: m };
    case "municipios":
      return m === "despesas" ? { path: "municipios_despesas.json" } : null;
  }
}

/** Hook: árvore atual. */
export function useTree(esfera: Esfera, uf: string, modo: Modo): Loadable<Node> & { indisponivel: boolean } {
  const src = treeSource(esfera, uf, modo);
  const r = useJson<Node | UfArquivo>(src?.path ?? null);
  const data = r.data && src?.key ? (r.data as UfArquivo)[src.key] : (r.data as Node | undefined);
  return { ...r, data, indisponivel: !src };
}

export const useMeta = () => useJson<Meta>("meta.json");
export const useSaldo = (ativo: boolean) => useJson<SaldoArquivo>(ativo ? "saldo.json" : null);
export const useComparar = (ativo: boolean) => useJson<CompararArquivo>(ativo ? "comparar.json" : null);
export const useGeo = (ativo: boolean) => useJson<GeoJSON>(ativo ? "geo/br_uf.json" : null);

export interface GeoJSON {
  type: "FeatureCollection";
  features: { type: "Feature"; properties: { name: string; nome: string; cod_ibge: number }; geometry: unknown }[];
}
