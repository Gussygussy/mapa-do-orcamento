import { create } from "zustand";
import type { Esfera, Modo, Tema, Unidade, Visualizacao } from "../types";
import { relId } from "../lib/tree";

export interface AppState {
  modo: Modo;
  esfera: Esfera;
  /** UF selecionada quando esfera = "estado" */
  uf: string;
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
  setUnidade: (u: Unidade) => void;
  setViz: (v: Visualizacao) => void;
  select: (id: string | null) => void;
  toggleTema: () => void;
  setDrawer: (open: boolean) => void;
  setGlossario: (open: boolean) => void;
}

/** Árvore exibida: no modo Saldo a navegação usa a árvore de despesas. */
export function treeModo(modo: Modo): "despesas" | "receitas" {
  return modo === "receitas" ? "receitas" : "despesas";
}

/** Prefixo dos ids da árvore atual (1º segmento). */
export function esferaPrefix(esfera: Esfera, uf: string): string {
  if (esfera === "estado") return uf;
  if (esfera === "comparar") return "estados";
  return esfera;
}

export function rootId(esfera: Esfera, uf: string, modo: Modo): string {
  if (esfera === "municipios") return "municipios.despesas";
  return `${esferaPrefix(esfera, uf)}.${treeModo(modo)}`;
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
    const [pref, segModo] = no.split(".");
    if (pref === "uniao" || pref === "estados" || pref === "municipios") out.esfera = pref;
    else if (pref && UF_RE.test(pref)) {
      out.esfera = "estado";
      out.uf = pref;
    }
    if (segModo === "despesas" || segModo === "receitas") out.modo = segModo;
    out.selectedId = no;
  }
  if (esfera && ESFERAS.includes(esfera)) {
    out.esfera = esfera;
    if (esfera === "estado") {
      const uf = p.get("uf");
      if (uf && UF_RE.test(uf)) out.uf = uf;
    }
  }
  if (modo && MODOS.includes(modo)) out.modo = modo;
  return out;
}

export function urlFromState(s: Pick<AppState, "modo" | "esfera" | "uf" | "unidade" | "viz" | "selectedId">): string {
  const p = new URLSearchParams();
  const raiz = rootId(s.esfera, s.uf, s.modo);
  p.set("no", s.selectedId ?? raiz);
  if (s.modo === "saldo") p.set("modo", "saldo");
  if (s.esfera === "comparar") p.set("esfera", "comparar");
  if (s.unidade !== "reais") p.set("unidade", s.unidade);
  if (s.viz !== "treemap") p.set("viz", s.viz);
  return `?${p.toString()}`;
}

export const useApp = create<AppState>((set, get) => ({
  modo: "despesas",
  esfera: "uniao",
  uf: "SP",
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
    // tenta manter o mesmo nó (caminho relativo) na nova esfera
    const atual = s.selectedId;
    let selectedId: string | null = null;
    if (atual && esfera !== "municipios") {
      const r = relId(atual);
      selectedId = r ? `${esferaPrefix(esfera, s.uf)}.${r}` : null;
    }
    set({ esfera, unidade, selectedId, drawerOpen: false });
  },
  setUf: (uf) => {
    const s = get();
    const r = s.selectedId ? relId(s.selectedId) : "";
    set({ uf, esfera: "estado", selectedId: r ? `${uf}.${r}` : null });
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
    useApp.setState({ modo: "despesas", esfera: "uniao", unidade: "reais", viz: "treemap", selectedId: null, ...parcial });
  };
  window.addEventListener("popstate", onPop);
  return () => {
    unsub();
    window.removeEventListener("popstate", onPop);
  };
}
