import { useEffect, useMemo, type ReactNode } from "react";
import { bindURL, rootId, useApp } from "./store/useApp";
import { useComparar, useMeta, useMunicipiosIndice, useSaldo, useTree } from "./lib/data";
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
  const app = useApp();
  const { modo, esfera, uf, munEscopo, munUf, munCod, unidade, selectedId, tema, drawerOpen, select, setDrawer } = app;
  const escuro = tema === "escuro";
  const meta = useMeta();
  const indice = useMunicipiosIndice(esfera === "municipios");
  const mun = munEscopo === "municipio" && munCod ? indice.data?.find((m) => m[0] === munCod) : undefined;
  // o índice diz se o município tem o dado; assim não se pede um arquivo que não existe
  const semDado = esfera === "municipios" && munEscopo === "municipio" && !!mun && !(modo === "receitas" ? mun[5] : mun[4]);
  const tree = useTree(app, modo, semDado);
  const saldo = useSaldo(modo === "saldo");
  const comparar = useComparar(esfera === "comparar");

  const root = tree.data;
  const raizId = rootId(app, modo);
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
    let pop = meta.data.populacao.brasil;
    if (esfera === "estado") pop = meta.data.populacao.uf[uf] ?? NaN;
    else if (esfera === "municipios" && munEscopo === "uf") pop = meta.data.populacao.uf[munUf] ?? NaN;
    else if (esfera === "municipios" && munEscopo === "municipio") pop = mun?.[3] ?? NaN;
    return { unidade, total: root.valor, pib: meta.data.pib.valor, pop };
  }, [meta.data, root, esfera, uf, munEscopo, munUf, mun, unidade]);

  const nomeEsfera =
    esfera === "uniao" ? "União" : esfera === "estado" ? meta.data?.ufs.find((u) => u.sigla === uf)?.nome ?? uf : esfera === "municipios" ? "Municípios" : "Estados e DF";
  const saldoChave = esfera === "estado" ? uf : esfera === "uniao" ? "uniao" : "estados";

  let centro: ReactNode;
  if (esfera === "municipios" && munEscopo === "municipio" && !munCod) {
    centro = (
      <div className="p-4">
        <Aviso>Digite o nome de um município no campo “Município”, na barra acima, para ver as contas dele.</Aviso>
      </div>
    );
  } else if (tree.indisponivel) {
    const oQue = modo === "receitas" ? "receitas" : "despesas";
    centro = (
      <div className="p-4">
        <Aviso>
          {mun
            ? `Dado não disponível: ${mun[1]} (${mun[2]}) não tem as ${oQue} de 2025 na Declaração de Contas Anuais (DCA) do Siconfi. Isso costuma acontecer quando o município não enviou as contas ao Tesouro.`
            : `Dado não disponível: não há ${oQue} para esta seleção nas fontes usadas.`}
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
      <TopBar meta={meta.data} indice={indice.data} />
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
