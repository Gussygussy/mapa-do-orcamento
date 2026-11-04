import { create } from "zustand";
import type { Esfera, Modo, Tema, Unidade, Visualizacao } from "../types";
import { relId } from "../lib/tree";

/** Abrangência dentro da esfera "municipios". */
export type MunEscopo = "brasil" | "uf" | "municipio";
/** Camada exibida em "Comparar estados": governo estadual ou soma dos municípios da UF. */
export type Camada = "estados" | "municipios";

export interface AppState {
  modo: Modo;
  esfera: Esfera;
  /** UF selecionada quando esfera = "estado" */
  uf: string;
  /** esfera = "municipios": todos, os de uma UF ou um município */
  munEscopo: MunEscopo;
  munUf: string;
  /** código IBGE do município (7 dígitos) */
  munCod: number | null;
  camada: Camada;
  unidade: Unidade;
  viz: Visualizacao;
  /** id do nó selecionado; null = raiz da árvore atual */
  selectedId: string | null;
  tema: Tema;
  drawerOpen: boolean;
  glossarioOpen: boolean;
  setModo: (m: Modo) => void;
  setEsfera: (e: Esfera) => void;
  setUf: (uf: string) => void;
  setMunEscopo: (e: MunEscopo) => void;
  setMunUf: (uf: string) => void;
  setMunCod: (cod: number) => void;
  setCamada: (c: Camada) => void;
  setUnidade: (u: Unidade) => void;
  setViz: (v: Visualizacao) => void;
  select: (id: string | null) => void;
  toggleTema: () => void;
  setDrawer: (open: boolean) => void;
  setGlossario: (open: boolean) => void;
}

type Local = Pick<AppState, "esfera" | "uf" | "munEscopo" | "munUf" | "munCod" | "camada">;

/** Árvore exibida: no modo Saldo a navegação usa a árvore de despesas. */
export function treeModo(modo: Modo): "despesas" | "receitas" {
  return modo === "receitas" ? "receitas" : "despesas";
}

/** Prefixo dos ids da árvore atual (1º segmento): "uniao", "SP", "m-SP", "m3550308"… */
export function esferaPrefix(s: Local): string {
  switch (s.esfera) {
    case "estado":
      return s.uf;
    case "comparar":
      return s.camada === "municipios" ? "municipios" : "estados";
    case "municipios":
      if (s.munEscopo === "uf") return `m-${s.munUf}`;
      if (s.munEscopo === "municipio" && s.munCod) return `m${s.munCod}`;
      return "municipios";
    default:
      return s.esfera;
  }
}

export function rootId(s: Local, modo: Modo): string {
  return `${esferaPrefix(s)}.${treeModo(modo)}`;
}

function temaInicial(): Tema {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) return "escuro";
  return "claro";
}

const MODOS: Modo[] = ["despesas", "receitas", "saldo"];
const ESFERAS: Esfera[] = ["uniao", "estados", "estado", "municipios", "comparar"];
const UNIDADES: Unidade[] = ["reais", "pct_total", "pct_pib", "per_capita"];
const VIZ: Visualizacao[] = ["treemap", "sunburst", "barras"];
const UF_RE = /^[A-Z]{2}$/;

/** Lê o estado inicial da URL (?no=…&modo=…&esfera=…&unidade=…&viz=…). */
export function stateFromURL(search: string): Partial<AppState> {
  const p = new URLSearchParams(search);
  const out: Partial<AppState> = {};
  const no = p.get("no");
  const modo = p.get("modo") as Modo | null;
  const esfera = p.get("esfera") as Esfera | null;
  const unidade = p.get("unidade") as Unidade | null;
  const viz = p.get("viz") as Visualizacao | null;
  if (unidade && UNIDADES.includes(unidade)) out.unidade = unidade;
  if (viz && VIZ.includes(viz)) out.viz = viz;
  if (no) {
    const [pref = "", segModo] = no.split(".");
    let mm: RegExpMatchArray | null;
    if (pref === "uniao" || pref === "estados") out.esfera = pref;
    else if (pref === "municipios") Object.assign(out, { esfera: "municipios", munEscopo: "brasil" });
    else if ((mm = pref.match(/^m-([A-Z]{2})$/))) Object.assign(out, { esfera: "municipios", munEscopo: "uf", munUf: mm[1] });
    else if ((mm = pref.match(/^m(\d{7})$/)))
      Object.assign(out, { esfera: "municipios", munEscopo: "municipio", munCod: Number(mm[1]) });
    else if (UF_RE.test(pref)) Object.assign(out, { esfera: "estado", uf: pref });
    if (segModo === "despesas" || segModo === "receitas") out.modo = segModo;
    out.selectedId = no;
  }
  if (esfera && ESFERAS.includes(esfera)) {
    out.esfera = esfera;
    if (esfera === "comparar") out.camada = p.get("camada") === "municipios" ? "municipios" : "estados";
  }
  if (modo && MODOS.includes(modo)) out.modo = modo;
  return out;
}

export function urlFromState(
  s: Local & Pick<AppState, "modo" | "unidade" | "viz" | "selectedId">,
): string {
  const p = new URLSearchParams();
  p.set("no", s.selectedId ?? rootId(s, s.modo));
  if (s.modo === "saldo") p.set("modo", "saldo");
  if (s.esfera === "comparar") {
    p.set("esfera", "comparar");
    if (s.camada === "municipios") p.set("camada", "municipios");
  }
  if (s.unidade !== "reais") p.set("unidade", s.unidade);
  if (s.viz !== "treemap") p.set("viz", s.viz);
  return `?${p.toString()}`;
}

/** Leva o nó selecionado (caminho relativo) para outra árvore. */
function mover(selectedId: string | null, novo: Local): string | null {
  const r = selectedId ? relId(selectedId) : "";
  return r ? `${esferaPrefix(novo)}.${r}` : null;
}

export const useApp = create<AppState>((set, get) => ({
  modo: "despesas",
  esfera: "uniao",
  uf: "SP",
  munEscopo: "brasil",
  munUf: "SP",
  munCod: null,
  camada: "estados",
  unidade: "reais",
  viz: "treemap",
  selectedId: null,
  tema: temaInicial(),
  drawerOpen: false,
  glossarioOpen: false,
  setModo: (modo) => {
    const s = get();
    // Mantém a seleção quando a árvore não muda (despesas <-> saldo usam a mesma árvore).
    const mesmaArvore = treeModo(modo) === treeModo(s.modo);
    set({ modo, selectedId: mesmaArvore ? s.selectedId : null });
  },
  setEsfera: (esfera) => {
    const s = get();
    let unidade = s.unidade;
    if (esfera === "comparar" && unidade === "pct_pib") unidade = "per_capita";
    const modo = (esfera === "municipios" || esfera === "comparar") && s.modo === "saldo" ? "despesas" : s.modo;
    const novo = { ...s, esfera };
    set({ esfera, unidade, modo, selectedId: mover(s.selectedId, novo), drawerOpen: false });
  },
  setUf: (uf) => {
    const s = get();
    set({ uf, esfera: "estado", selectedId: mover(s.selectedId, { ...s, esfera: "estado", uf }) });
  },
  setMunEscopo: (munEscopo) => {
    const s = get();
    const novo = { ...s, esfera: "municipios" as const, munEscopo };
    set({ esfera: "municipios", munEscopo, selectedId: mover(s.selectedId, novo) });
  },
  setMunUf: (munUf) => {
    const s = get();
    const novo = { ...s, esfera: "municipios" as const, munEscopo: "uf" as const, munUf };
    set({ esfera: "municipios", munEscopo: "uf", munUf, selectedId: mover(s.selectedId, novo) });
  },
  setMunCod: (munCod) => {
    const s = get();
    const novo = { ...s, esfera: "municipios" as const, munEscopo: "municipio" as const, munCod };
    set({ esfera: "municipios", munEscopo: "municipio", munCod, selectedId: mover(s.selectedId, novo), drawerOpen: false });
  },
  setCamada: (camada) => {
    const s = get();
    set({ camada, selectedId: mover(s.selectedId, { ...s, camada }) });
  },
  setUnidade: (unidade) => set({ unidade }),
  setViz: (viz) => set({ viz }),
  select: (selectedId) => set({ selectedId, drawerOpen: false }),
  toggleTema: () => {
    const tema: Tema = get().tema === "escuro" ? "claro" : "escuro";
    document.documentElement.classList.toggle("dark", tema === "escuro");
    document.documentElement.style.colorScheme = tema === "escuro" ? "dark" : "light";
    try {
      localStorage.setItem("tema", tema);
    } catch {
      /* localStorage é opcional */
    }
    set({ tema });
  },
  setDrawer: (drawerOpen) => set({ drawerOpen }),
  setGlossario: (glossarioOpen) => set({ glossarioOpen }),
}));

/** Liga o store à URL: lê ao iniciar, grava a cada mudança e reage ao botão "voltar". */
export function bindURL(): () => void {
  useApp.setState(stateFromURL(window.location.search));
  let ultimo = urlFromState(useApp.getState());
  const unsub = useApp.subscribe((s) => {
    const url = urlFromState(s);
    if (url !== ultimo) {
      ultimo = url;
      try {
        window.history.pushState(null, "", url);
      } catch {
        /* alguns ambientes (iframes isolados) recusam pushState; o app segue funcionando */
      }
    }
  });
  const onPop = () => {
    const parcial = stateFromURL(window.location.search);
    ultimo = window.location.search || ultimo;
    useApp.setState({
      modo: "despesas", esfera: "uniao", munEscopo: "brasil", camada: "estados", unidade: "reais", viz: "treemap",
      selectedId: null, ...parcial,
    });
  };
  window.addEventListener("popstate", onPop);
  return () => {
    unsub();
    window.removeEventListener("popstate", onPop);
  };
}
