import { useMemo } from "react";
import type { CompararArquivo, Meta, Node, Unidade } from "../types";
import { formatBRL, formatPct, formatReais } from "../lib/format";
import { relId } from "../lib/tree";
import { UNIDADE_LABEL } from "../lib/units";
import { useApp } from "../store/useApp";
import { useGeo } from "../lib/data";
import { BrasilMap, RankingChart, type UfValor } from "./charts/MapCharts";
import { Breadcrumb } from "./Breadcrumb";
import { Aviso, Carregando, Segmented } from "./ui";
import type { Camada } from "../store/useApp";

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
  const { unidade, modo, camada, setCamada, setUf, setMunUf } = useApp();
  const geo = useGeo(true);
  const modoArv = modo === "receitas" ? "receitas" : "despesas";
  const chave: keyof CompararArquivo = camada === "municipios" ? `municipios_${modoArv}` : modoArv;
  const tab = comparar[chave];
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
  // o DF não tem municípios: na camada municipal ele não conta como "sem dado"
  const semDado = dados.filter((d) => !Number.isFinite(d.valor) && !(camada === "municipios" && d.uf === "DF"));
  const explicacao =
    camada === "municipios"
      ? "Cada UF mostra a soma das contas dos seus municípios. O DF não tem municípios."
      : "Cada UF mostra as contas do governo estadual.";
  const titulo = `${node.nome} – ${UNIDADE_LABEL[unidade]}${unidade === "pct_total" ? " do total da UF" : ""}`;
  // clique numa UF abre a árvore dela: do governo estadual ou da soma dos seus municípios
  const abrirUf = (uf: string) => (camada === "municipios" ? setMunUf(uf) : setUf(uf));
  return (
    <div className="space-y-3 p-4">
      <Breadcrumb path={path} onSelect={onSelect} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold">Comparar estados: {titulo}</h2>
        <Segmented<Camada>
          label="Comparar"
          value={camada}
          onChange={setCamada}
          options={[
            { value: "estados", label: "Governo estadual" },
            { value: "municipios", label: "Municípios do estado" },
          ]}
        />
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-300">{explicacao}</p>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Escolha um item na árvore para mudar a métrica. Clique numa UF para abrir a árvore daquele estado.
        {unidade === "reais" && " Em R$, os estados maiores dominam; use per capita para comparar."}
      </p>
      {semDado.length > 0 && (
        <Aviso>
          Dado não disponível para {semDado.length} UF(s): {semDado.map((d) => d.uf).join(", ")} (o item não aparece nas contas
          {camada === "municipios" ? " dos municípios dessas UFs" : " desses estados"}).
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
        {camada === "municipios"
          ? "Fonte: Siconfi/Tesouro – DCA 2025 dos municípios, somada por UF (quem não enviou fica de fora); "
          : "Fonte: Siconfi/Tesouro – RREO 2025, 6º bimestre, de cada UF; "}
        população: IBGE, estimativa de 1º/jul/2025.
      </p>
    </div>
  );
}
