import type { Indicador, Node } from "../types";
import { formatBRL, formatIndicador, formatPct, formatReais } from "../lib/format";
import { formatMetric, type UnitCtx } from "../lib/units";
import { hasMixedBases, isOutros, sumChildren, toCSV } from "../lib/tree";
import type { TermoGlossario } from "../lib/glossario";
import { Aviso, Badge, Card, EstimativaBadge, Secao, Termo } from "./ui";
import { BarsChart, SerieChart } from "./charts/NodeCharts";
import { ChildrenTable } from "./ChildrenTable";

const TERMO_BASE: Record<string, TermoGlossario> = {
  empenhado: "empenhado",
  liquidado: "liquidado",
  pago: "pago",
  caixa: "caixa",
  arrecadado: "arrecadado",
};

const ROTULO_TERMO: Partial<Record<TermoGlossario, string>> = {
  encargos: "Encargos Especiais",
  rgps: "RGPS",
  rpps: "RPPS",
  intra: "intraorçamentárias",
  comprev: "Comprev",
  bpc: "BPC",
  fundeb: "Fundeb",
};

/** Termos do glossário a sugerir conforme o nome do nó. */
function termosDoNo(n: Node): TermoGlossario[] {
  const s = `${n.nome} ${n.nota ?? ""}`.toLowerCase();
  const out: TermoGlossario[] = [];
  if (s.includes("encargos especiais")) out.push("encargos");
  if (s.includes("rgps") || s.includes("previdência básica")) out.push("rgps");
  if (s.includes("rpps") || s.includes("estatutário")) out.push("rpps");
  if (s.includes("intra")) out.push("intra");
  if (s.includes("comprev")) out.push("comprev");
  if (s.includes("bpc")) out.push("bpc");
  if (s.includes("fundeb")) out.push("fundeb");
  return out;
}

function baixarCSV(n: Node) {
  const blob = new Blob([toCSV(n)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${n.id}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function IndicadorItem({ nome, ind }: { nome: string; ind: Indicador }) {
  const titulo = ind.nota ?? nome.replace(/_/g, " ");
  return (
    <li className="rounded-md border border-slate-200 p-2 dark:border-slate-800">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-slate-700 dark:text-slate-300">{titulo}</span>
        <span className="shrink-0 font-semibold tabular-nums">{formatIndicador(ind.valor, ind.unidade)}</span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400">
        {ind.estimado && <EstimativaBadge />}
        <a href={ind.fonte.url} target="_blank" rel="noreferrer" className="underline">
          {ind.fonte.nome}
        </a>
      </div>
    </li>
  );
}

export function DetailPanel({ node, root, parent, ctx, escuro, onSelect }: {
  node: Node;
  root: Node;
  parent?: Node;
  ctx: UnitCtx;
  escuro: boolean;
  onSelect: (id: string) => void;
}) {
  const pctTotal = root.valor ? (100 * node.valor) / root.valor : NaN;
  const pctPib = ctx.pib ? (100 * node.valor) / ctx.pib : NaN;
  const perCapita = ctx.pop ? (node.valor * 1e6) / ctx.pop : NaN;
  const serie = node.serie ?? [];
  const s2024 = serie.find((s) => s.ano === 2024);
  const s2025 = serie.find((s) => s.ano === 2025);
  const varNominal = s2024 && s2025 && s2024.valor ? 100 * (s2025.valor / s2024.valor - 1) : null;
  const misto = hasMixedBases(node);
  const paiMisto = parent && parent.base !== node.base;
  const estimado = !!node.estimado || isOutros(node);
  const indicadores = Object.entries(node.indicadores ?? {});
  const termos = termosDoNo(node);
  const somaFilhos = sumChildren(node);

  return (
    <div className="space-y-5 p-4">
      <header className="space-y-2">
        <h2 className="text-xl font-bold leading-tight">{node.nome}</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge cor="azul">
            <Termo termo={TERMO_BASE[node.base] ?? "empenhado"}>base: {node.base}</Termo>
          </Badge>
          <Badge>{node.precos === "dez/2025 IPCA" ? "preços de dez/2025 (IPCA)" : "valores nominais de 2025"}</Badge>
          {estimado && <EstimativaBadge />}
          {termos.map((t) => (
            <Badge key={t}>
              <Termo termo={t}>{ROTULO_TERMO[t] ?? t}</Termo>
            </Badge>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Card titulo="Valor" valor={formatBRL(node.valor)} detalhe={ctx.unidade !== "reais" ? formatMetric(node.valor, ctx) : undefined} />
        <Card titulo="% do total" valor={formatPct(pctTotal)} detalhe={`de ${root.nome}`} />
        <Card titulo="% do PIB" valor={formatPct(pctPib)} detalhe="do PIB do Brasil em 2025" />
        <Card titulo="Per capita" valor={formatReais(perCapita)} detalhe="por habitante em 2025" />
        {varNominal !== null && (
          <Card titulo="Variação ante 2024" valor={formatPct(varNominal)} detalhe="nominal (sem descontar a inflação)" />
        )}
        {parent && (
          <Card titulo="% do item acima" valor={formatPct(parent.valor ? (100 * node.valor) / parent.valor : NaN)} detalhe={parent.nome} />
        )}
      </div>

      {(misto || paiMisto) && (
        <Aviso tipo="alerta">
          <strong>Bases diferentes.</strong>{" "}
          {misto
            ? `Este item está em base "${node.base}", mas parte das subdivisões está em outra base (${[...new Set((node.filhos ?? []).map((f) => f.base))].join(", ")}). Os valores não batem centavo por centavo.`
            : `Este item está em base "${node.base}" e o item acima em "${parent!.base}". Os valores não batem centavo por centavo.`}
        </Aviso>
      )}

      {node.nota && <Aviso>{node.nota}</Aviso>}

      {!!node.filhos?.length && (
        <Secao
          titulo="Composição"
          acoes={
            <button
              type="button"
              onClick={() => baixarCSV(node)}
              className="rounded-md border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Exportar CSV
            </button>
          }
        >
          <BarsChart key={node.id} node={node} ctx={ctx} escuro={escuro} onSelect={onSelect} />
          <ChildrenTable node={node} ctx={ctx} onSelect={onSelect} />
          {Math.abs(somaFilhos - node.valor) > Math.max(0.2, Math.abs(node.valor) * 0.001) && (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Soma das subdivisões: {formatBRL(somaFilhos)} ({formatPct((100 * somaFilhos) / node.valor)} do total).
            </p>
          )}
        </Secao>
      )}

      {serie.length > 1 && (
        <Secao titulo={`Série histórica (${serie[0]!.ano}–${serie.at(-1)!.ano}, valores nominais)`}>
          <SerieChart node={node} escuro={escuro} />
        </Secao>
      )}

      {indicadores.length > 0 && (
        <Secao titulo="Outros indicadores">
          <ul className="space-y-1.5">
            {indicadores.map(([k, ind]) => (
              <IndicadorItem key={k} nome={k} ind={ind} />
            ))}
          </ul>
        </Secao>
      )}

      <Secao titulo="Fontes e notas">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {node.fonte.map((f) => (
            <li key={f.url + f.nome}>
              <a href={f.url} target="_blank" rel="noreferrer" className="text-blue-700 underline dark:text-blue-300">
                {f.nome}
              </a>
              {f.tabela && <span className="text-slate-600 dark:text-slate-400"> — {f.tabela}</span>}
            </li>
          ))}
        </ul>
        {estimado && (
          <p className="text-xs text-amber-800 dark:text-amber-300">
            <Termo termo="estimativa">Valor estimado</Termo>: {isOutros(node) ? "diferença entre o total do item acima e a soma das partes detalhadas." : node.nota}
          </p>
        )}
        <p className="text-xs text-slate-600 dark:text-slate-400">
          % do PIB usa o PIB nominal do Brasil em 2025 ({formatBRL(ctx.pib)}). Per capita usa a população estimada pelo IBGE para 1º/jul/2025 ({new Intl.NumberFormat("pt-BR").format(ctx.pop)} habitantes).
        </p>
      </Secao>
    </div>
  );
}
