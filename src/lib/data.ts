import { useEffect, useMemo, useState } from "react";
import type { CompararArquivo, Meta, Modo, Node, SaldoArquivo, UfArquivo } from "../types";
import { treeModo, type AppState } from "../store/useApp";
import { arvoreMunicipio, type MunicipioArquivo, type MunicipioIndice } from "./municipio";

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

type Local = Pick<AppState, "esfera" | "uf" | "munEscopo" | "munUf" | "munCod" | "camada">;

export type OrigemArvore = { path: string; key?: "despesas" | "receitas"; compacto?: boolean };

/** Arquivo e chave da árvore para a combinação atual. null = ainda não há o que mostrar. */
export function treeSource(s: Local, modo: Modo): OrigemArvore | null {
  const m = treeModo(modo);
  switch (s.esfera) {
    case "uniao":
      return { path: `uniao_${m}.json` };
    case "estados":
      return { path: `estados_${m}.json` };
    case "comparar":
      return { path: s.camada === "municipios" ? `municipios_${m}.json` : `estados_${m}.json` };
    case "estado":
      return { path: `estados/${s.uf}.json`, key: m };
    case "municipios":
      if (s.munEscopo === "uf") return { path: `municipios_uf/${s.munUf}.json`, key: m };
      if (s.munEscopo === "municipio") return s.munCod ? { path: `municipios/${s.munCod}.json`, key: m, compacto: true } : null;
      return { path: `municipios_${m}.json` };
  }
}

/** Hook: árvore atual. `indisponivel` = a fonte não tem este dado (ex.: município sem DCA).
 *  `semDado`: o índice já diz que não há dado (evita pedir um arquivo inexistente). */
export function useTree(s: Local, modo: Modo, semDado = false): Loadable<Node> & { indisponivel: boolean } {
  const src = semDado ? null : treeSource(s, modo);
  const r = useJson<Node | UfArquivo | MunicipioArquivo>(src?.path ?? null);
  const key = src?.key;
  const compacto = !!src?.compacto;
  const data = useMemo((): Node | null | undefined => {
    if (!r.data) return undefined;
    if (compacto) return arvoreMunicipio(r.data as MunicipioArquivo, key!);
    if (key) return (r.data as unknown as Record<string, Node | null>)[key] ?? null;
    return r.data as Node;
  }, [r.data, key, compacto]);
  return { ...r, data: data ?? undefined, indisponivel: semDado || !src || data === null };
}

export const useMeta = () => useJson<Meta>("meta.json");
export const useSaldo = (ativo: boolean) => useJson<SaldoArquivo>(ativo ? "saldo.json" : null);
export const useComparar = (ativo: boolean) => useJson<CompararArquivo>(ativo ? "comparar.json" : null);
export const useMunicipiosIndice = (ativo: boolean) => useJson<MunicipioIndice[]>(ativo ? "municipios_index.json" : null);
export const useGeo = (ativo: boolean) => useJson<GeoJSON>(ativo ? "geo/br_uf.json" : null);

export interface GeoJSON {
  type: "FeatureCollection";
  features: { type: "Feature"; properties: { name: string; nome: string; cod_ibge: number }; geometry: unknown }[];
}
