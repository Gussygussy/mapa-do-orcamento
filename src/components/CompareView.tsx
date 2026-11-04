import { useMemo } from "react";
import type { CompararArquivo, Meta, Node, Unidade } from "../types";
import { formatBRL, formatPct, formatReais } from "../lib/format";
import { relId } from "../lib/tree";
import { UNIDADE_LABEL } from "../lib/units";
import { useApp } from "../store/useApp";
import { useGeo } from "../lib/data";
import { BrasilMap, RankingChart, type UfValor } from "./charts/MapCharts";
import { Breadcrumb } from "./Breadcrumb";
import { Aviso, Carregando } from "./ui";

function rotular(v: number, u: Unidade): string {
  if (!Number.isFinite(v)) return "dado não disponível";
  if (u === "reais") return formatBRL(v);
  if (u === "per_capita") return `${formatReais(v)}/hab.`;
  return formatPct(v);
}

export function CompareView({ node, path, comparar, meta, escuro, onSelect }: {
  node: Node;
  path: Node[];
  comparar: CompararArquivo;
  meta: Meta;
  escuro: boolean;
  onSelect: (id: string) => void;
}) {
  const { unidade, modo, setUf, setEsfera } = useApp();
  const geo = useGeo(true);
  const modoArv = modo === "receitas" ? "receitas" : "despesas";
  const tab = comparar[modoArv];
  const rel = relId(node.id);
  const raizRel = rel.split(".")[0]!;
  const dados: UfValor[] = useMemo(() => {
    const valores = tab[rel] ?? {};
    const totais = tab[raizRel] ?? {};
    return meta.ufs.map((u) => {
      const v = valores[u.sigla];
      let m = NaN;
      if (v !== undefined) {
        if (unidade === "reais") m = v;
        else if (unidade === "per_capita") m = (v * 1e6) / (meta.populacao.uf[u.sigla] ?? NaN);
        else if (unidade === "pct_total") m = totais[u.sigla] ? (100 * v) / totais[u.sigla]! : NaN;
      }
      return { uf: u.sigla, nome: u.nome, valor: m, rotulo: rotular(m, unidade) };
    });
  }, [tab, rel, raizRel, unidade, meta]);
  const semDado = dados.filter((d) => !Number.isFinite(d.valor));
  const titulo = `${node.nome} – ${UNIDADE_LABEL[unidade]}${unidade === "pct_total" ? " do estado" : ""}`;
  const abrirUf = (uf: string) => {
    setEsfera("estado");
    setUf(uf);
  };
  return (
    <div className="space-y-3 p-4">
      <Breadcrumb path={path} onSelect={onSelect} />
      <h2 className="text-lg font-semibold">Comparar estados: {titulo}</h2>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Escolha um item na árvore para mudar a métrica. Clique numa UF para abrir a árvore daquele estado.
        {unidade === "reais" && " Em R$, os estados maiores dominam; use per capita para comparar."}
      </p>
      {semDado.length > 0 && (
        <Aviso>
          Dado não disponível para {semDado.length} UF(s): {semDado.map((d) => d.uf).join(", ")} (o item não aparece no RREO desses estados).
        </Aviso>
      )}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          {geo.data ? (
            <BrasilMap geo={geo.data} dados={dados} escuro={escuro} titulo={titulo} onSelect={abrirUf} />
          ) : geo.error ? (
            <Aviso tipo="alerta">Não foi possível carregar o mapa.</Aviso>
          ) : (
            <Carregando texto="Carregando mapa…" />
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="px-2 pt-1 text-sm font-semibold">Ranking</h3>
          <RankingChart dados={dados} escuro={escuro} titulo={titulo} onSelect={abrirUf} />
        </div>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Fonte: Siconfi/Tesouro – RREO 2025, 6º bimestre, de cada UF; população: IBGE, estimativa de 1º/jul/2025.
      </p>
    </div>
  );
}
