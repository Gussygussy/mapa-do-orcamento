import { useEffect, useMemo, type ReactNode } from "react";
import { bindURL, rootId, useApp } from "./store/useApp";
import { useComparar, useMeta, useSaldo, useTree } from "./lib/data";
import { findNode, parentOf, pathTo } from "./lib/tree";
import type { UnitCtx } from "./lib/units";
import { TopBar } from "./components/TopBar";
import { TreeNav } from "./components/TreeNav";
import { VizPanel } from "./components/VizPanel";
import { DetailPanel } from "./components/DetailPanel";
import { CompareView } from "./components/CompareView";
import { SaldoView } from "./components/SaldoView";
import { GlossarioDialog } from "./components/GlossarioDialog";
import { Aviso, Carregando } from "./components/ui";

export default function App() {
  useEffect(() => bindURL(), []);
  const { modo, esfera, uf, unidade, selectedId, tema, drawerOpen, select, setDrawer } = useApp();
  const escuro = tema === "escuro";
  const meta = useMeta();
  const tree = useTree(esfera, uf, modo);
  const saldo = useSaldo(modo === "saldo");
  const comparar = useComparar(esfera === "comparar");

  const root = tree.data;
  const raizId = rootId(esfera, uf, modo);
  const node = useMemo(() => (root ? findNode(root, selectedId ?? raizId) ?? root : undefined), [root, selectedId, raizId]);
  const path = useMemo(() => (root && node ? pathTo(root, node.id) : []), [root, node]);
  const parent = useMemo(() => (root && node ? parentOf(root, node.id) : undefined), [root, node]);

  // Se o id pedido não existe nesta árvore, a seleção volta para a raiz (sem empilhar histórico).
  useEffect(() => {
    if (root && selectedId && !findNode(root, selectedId)) useApp.setState({ selectedId: null });
  }, [root, selectedId]);

  useEffect(() => {
    if (node) document.title = `${node.nome} – Orçamento Brasil 2025`;
  }, [node]);

  const ctx: UnitCtx | undefined = useMemo(() => {
    if (!meta.data || !root) return undefined;
    const pop = esfera === "estado" ? meta.data.populacao.uf[uf] ?? NaN : meta.data.populacao.brasil;
    return { unidade, total: root.valor, pib: meta.data.pib.valor, pop };
  }, [meta.data, root, esfera, uf, unidade]);

  const nomeEsfera =
    esfera === "uniao" ? "União" : esfera === "estado" ? meta.data?.ufs.find((u) => u.sigla === uf)?.nome ?? uf : esfera === "municipios" ? "Municípios" : "Estados e DF";
  const saldoChave = esfera === "estado" ? uf : esfera === "uniao" ? "uniao" : "estados";

  let centro: ReactNode;
  if (tree.indisponivel) {
    centro = (
      <div className="p-4">
        <Aviso>
          Dado não disponível: as receitas dos municípios ainda não foram agregadas nesta versão. Use “Despesas” ou escolha outra esfera.
        </Aviso>
      </div>
    );
  } else if (tree.error || meta.error) {
    centro = (
      <div className="p-4">
        <Aviso tipo="alerta">Não foi possível carregar os dados: {tree.error ?? meta.error}</Aviso>
      </div>
    );
  } else if (!root || !node || !ctx || !meta.data) {
    centro = <Carregando />;
  } else if (modo === "saldo") {
    centro = <SaldoView itens={saldo.data?.[saldoChave]} titulo={nomeEsfera} escuro={escuro} />;
  } else if (esfera === "comparar") {
    centro = comparar.data ? (
      <CompareView node={node} path={path} comparar={comparar.data} meta={meta.data} escuro={escuro} onSelect={select} />
    ) : (
      <Carregando />
    );
  } else {
    centro = <VizPanel root={root} node={node} path={path} parent={parent} ctx={ctx} escuro={escuro} onSelect={select} />;
  }

  return (
    <div className="flex h-full flex-col">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">
        Pular para o conteúdo
      </a>
      <TopBar meta={meta.data} />
      <div className="relative flex-1 lg:grid lg:min-h-0 lg:grid-cols-[320px_minmax(0,1fr)_420px]">
        {/* Árvore: coluna fixa no desktop, gaveta no celular */}
        {drawerOpen && (
          <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" aria-hidden="true" onClick={() => setDrawer(false)} />
        )}
        <aside
          aria-label="Navegação em árvore"
          className={
            "fixed inset-y-0 left-0 z-40 w-[min(340px,88vw)] border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:static lg:z-auto lg:w-auto lg:translate-x-0 lg:overflow-hidden " +
            (drawerOpen ? "translate-x-0" : "-translate-x-full")
          }
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 lg:hidden dark:border-slate-800">
            <span className="text-sm font-semibold">Árvore</span>
            <button type="button" onClick={() => setDrawer(false)} className="rounded px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
              Fechar
            </button>
          </div>
          {root && node && ctx ? (
            <TreeNav root={root} selectedId={node.id} ctx={ctx} onSelect={select} />
          ) : tree.indisponivel ? (
            <p className="p-4 text-sm text-slate-600 dark:text-slate-400">Dado não disponível.</p>
          ) : (
            <Carregando />
          )}
        </aside>

        <main id="conteudo" className="min-w-0 lg:overflow-auto">
          {centro}
        </main>

        <section
          aria-label="Detalhes do item selecionado"
          className="border-t border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40 lg:overflow-auto lg:border-l lg:border-t-0"
        >
          {root && node && ctx && !tree.indisponivel ? (
            <DetailPanel node={node} root={root} parent={parent} ctx={ctx} escuro={escuro} onSelect={select} />
          ) : null}
        </section>
      </div>
      <footer className="border-t border-slate-200 px-4 py-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
        Dados: Siconfi, Tesouro Nacional (RTN), Ministério da Previdência Social, IBGE, CONORF e IFI/Senado. Valores em R$ nominais de 2025.
        {meta.data && ` Atualizado em ${new Date(meta.data.atualizado_em + "T12:00:00").toLocaleDateString("pt-BR")}.`}
      </footer>
      <GlossarioDialog />
    </div>
  );
}
