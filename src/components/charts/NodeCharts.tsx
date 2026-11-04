import type { EChartsOption } from "echarts";
import type { Node } from "../../types";
import { formatBRL, formatPct } from "../../lib/format";
import { formatMetric, type UnitCtx } from "../../lib/units";
import { isOutros } from "../../lib/tree";
import { Chart } from "./Chart";
import { PALETA, esc, tokens } from "./echarts";

interface ChartProps {
  /** nó cujos filhos são desenhados */
  node: Node;
  ctx: UnitCtx;
  escuro: boolean;
  onSelect: (id: string) => void;
  /** id a destacar (ex.: folha selecionada) */
  highlight?: string;
  height?: number | string;
}

interface Datum {
  id: string;
  name: string;
  value: number;
  pctPai: number;
  fonte: string;
  estimado: boolean;
  children?: Datum[];
  itemStyle?: Record<string, unknown>;
}

/** Itens positivos (gráficos de área não representam valores negativos). */
function positivos(n: Node): Node[] {
  return (n.filhos ?? []).filter((f) => f.valor > 0);
}

function toDatum(n: Node, pai: Node, depth: number, cor?: string, highlight?: string): Datum {
  const d: Datum = {
    id: n.id,
    name: n.nome,
    value: n.valor,
    pctPai: pai.valor ? (100 * n.valor) / pai.valor : NaN,
    fonte: n.fonte[0]?.nome ?? "",
    estimado: !!n.estimado || isOutros(n),
  };
  const style: Record<string, unknown> = {};
  if (cor) style.color = cor;
  if (isOutros(n)) style.color = "#94a3b8";
  if (highlight && n.id === highlight) {
    style.borderColor = "#f59e0b";
    style.borderWidth = 4;
  }
  if (Object.keys(style).length) d.itemStyle = style;
  if (depth > 1) {
    const fs = positivos(n);
    if (fs.length) d.children = fs.map((f) => toDatum(f, n, depth - 1, undefined, highlight));
  }
  return d;
}

function tooltipFormatter(ctx: UnitCtx) {
  return (p: unknown) => {
    const d = (p as { data?: Datum }).data;
    if (!d) return "";
    const est = d.estimado ? '<br/><span style="color:#d97706">estimativa</span>' : "";
    const alt = ctx.unidade !== "reais" ? ` · ${formatMetric(d.value, ctx)}` : "";
    return (
      `<strong>${esc(d.name)}</strong><br/>${formatBRL(d.value)}${alt}` +
      `<br/>${formatPct(d.pctPai)} do item acima` +
      `<br/><span style="opacity:.75">Fonte: ${esc(d.fonte)}</span>${est}`
    );
  };
}

function baseTooltip(escuro: boolean, ctx: UnitCtx) {
  const t = tokens(escuro);
  return {
    trigger: "item" as const,
    confine: true,
    backgroundColor: t.tooltipBg,
    borderColor: t.grade,
    textStyle: { color: t.texto },
    formatter: tooltipFormatter(ctx),
  };
}

function descricao(node: Node, ctx: UnitCtx): string {
  const top = positivos(node)
    .slice(0, 5)
    .map((f) => `${f.nome}: ${formatMetric(f.valor, ctx)}`)
    .join("; ");
  return `Composição de ${node.nome}. Maiores itens: ${top}.`;
}

export function NegativosAviso({ node }: { node: Node }) {
  const neg = (node.filhos ?? []).filter((f) => f.valor < 0);
  if (!neg.length) return null;
  return (
    <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
      Itens com valor negativo não aparecem no gráfico: {neg.map((f) => `${f.nome} (${formatBRL(f.valor)})`).join(", ")}.
    </p>
  );
}

export function TreemapChart({ node, ctx, escuro, onSelect, highlight, height = 460 }: ChartProps) {
  const t = tokens(escuro);
  const data = positivos(node).map((f, i) => toDatum(f, node, 2, PALETA[i % PALETA.length], highlight));
  const option: EChartsOption = {
    // sem animação: a transição entre nós misturava rótulos antigos e novos
    animation: false,
    tooltip: baseTooltip(escuro, ctx),
    series: [
      {
        type: "treemap",
        data: data as never,
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        width: "100%",
        height: "100%",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        label: {
          show: true,
          formatter: (p: unknown) => {
            const d = (p as { data?: Datum }).data;
            return d?.name ? `${d.name}\n${formatMetric(d.value, ctx)}` : "";
          },
          overflow: "truncate",
          fontSize: 12,
        },
        upperLabel: {
          show: true,
          height: 22,
          color: "#fff",
          formatter: (p: unknown) => {
            const d = (p as { data?: Datum }).data;
            return d?.name ? `${d.name} · ${formatMetric(d.value, ctx)}` : "";
          },
        },
        itemStyle: { borderColor: t.borda, borderWidth: 1, gapWidth: 1 },
        levels: [
          { itemStyle: { borderColor: t.borda, borderWidth: 2, gapWidth: 2 } },
          { colorSaturation: [0.35, 0.6], itemStyle: { borderColorSaturation: 0.7, gapWidth: 1, borderWidth: 1 } },
        ],
      },
    ],
  };
  return (
    <Chart
      option={option}
      label={descricao(node, ctx)}
      height={height}
      onClick={(p) => {
        const d = p.data as Datum | undefined;
        if (d?.id) onSelect(d.id);
      }}
    />
  );
}

/** Mistura uma cor hex com branco (t = 0 mantém, 1 = branco). */
function clarear(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Corta o nome para caber no anel. */
function encurtar(nome: string, max: number): string {
  return nome.length > max ? nome.slice(0, max - 1) + "…" : nome;
}

export function SunburstChart({ node, ctx, escuro, onSelect, highlight, height = 460 }: ChartProps) {
  const t = tokens(escuro);
  const total = positivos(node).reduce((s, f) => s + f.valor, 0);
  // Anel interno: cores da paleta. Anel externo: tons do pai, do mais forte ao mais claro.
  const data = positivos(node).map((f, i) => {
    const cor = isOutros(f) ? "#94a3b8" : PALETA[i % PALETA.length]!;
    const d = toDatum(f, node, 1, cor, highlight);
    const netos = positivos(f);
    if (netos.length) {
      d.children = netos.map((n, k) => {
        const tom = isOutros(n) ? "#cbd5e1" : clarear(cor, 0.25 + 0.5 * (k / Math.max(1, netos.length - 1)));
        return toDatum(n, f, 1, tom, highlight);
      });
    }
    return d;
  });
  const option: EChartsOption = {
    tooltip: baseTooltip(escuro, ctx),
    series: [
      {
        type: "sunburst",
        data: data as never,
        center: ["50%", "50%"],
        nodeClick: false,
        sort: undefined,
        itemStyle: { borderColor: t.borda, borderWidth: 1.5 },
        emphasis: { focus: "ancestor" },
        levels: [
          {},
          {
            // anel interno: nomes ao longo do arco, só onde cabem
            r0: "26%",
            r: "62%",
            label: {
              rotate: "tangential",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              // texto reto não acompanha a curva: só fatias de 40° ou mais ganham nome, cortado ao
              // comprimento do arco (~1 caractere a cada 7,5 px, raio conservador de 70 px)
              minAngle: 40,
              formatter: (p: unknown) => {
                const d = (p as { data: Datum }).data;
                const caracteres = Math.floor(((d.value / total) * 2 * Math.PI * 70) / 7.5);
                return encurtar(d.name, Math.max(6, caracteres));
              },
            },
          },
          {
            // anel externo: nomes curtos, só nas fatias grandes
            r0: "62%",
            r: "94%",
            label: {
              rotate: "radial",
              color: "#1e293b",
              fontSize: 10,
              minAngle: 10,
              align: "center",
              // radial: o limite é a espessura do anel (~60 px)
              formatter: (p: unknown) => encurtar((p as { data: Datum }).data.name, 11),
            },
          },
        ],
      },
    ],
  };
  return (
    <div className="relative">
      <Chart
        option={option}
        label={descricao(node, ctx)}
        height={height}
        onClick={(p) => {
          const d = p.data as Datum | undefined;
          if (d?.id) onSelect(d.id);
        }}
      />
      {/* centro do anel: nome e total do item exibido */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <div className="max-w-[7.5rem] text-center leading-tight">
          <div className="line-clamp-2 text-[11px] text-slate-600 dark:text-slate-400">{node.nome}</div>
          <div className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatMetric(total, ctx)}</div>
        </div>
      </div>
      <p className="px-2 pb-1 text-xs text-slate-600 dark:text-slate-400">
        Anel interno: subdivisões de “{node.nome}”. Anel externo: o nível seguinte. Passe o mouse para ver nomes e valores.
      </p>
    </div>
  );
}

/** Barras horizontais ordenadas dos filhos (também usada no painel de detalhes). */
export function BarsChart({ node, ctx, escuro, onSelect, highlight, height }: ChartProps) {
  const t = tokens(escuro);
  const filhos = [...(node.filhos ?? [])].sort((a, b) => a.valor - b.valor);
  const data = filhos.map((f) => ({
    ...toDatum(f, node, 1, undefined, highlight),
    value: f.valor,
    itemStyle: {
      color: isOutros(f) ? "#94a3b8" : f.valor < 0 ? "#dc2626" : f.id === highlight ? "#f59e0b" : "#2563eb",
    },
  }));
  const h = height ?? Math.max(180, 28 * filhos.length + 40);
  const option: EChartsOption = {
    tooltip: baseTooltip(escuro, ctx),
    grid: { left: 8, right: 90, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: "value", show: false },
    yAxis: {
      type: "category",
      data: filhos.map((f) => f.nome),
      axisLabel: { color: t.texto, width: 180, overflow: "truncate", fontSize: 12 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        data: data as never,
        barMaxWidth: 22,
        label: {
          show: true,
          position: "right",
          color: t.textoSuave,
          fontSize: 11,
          formatter: (p: unknown) => formatMetric((p as { data: Datum }).data.value, ctx),
        },
      },
    ],
  };
  return (
    <Chart
      option={option}
      label={descricao(node, ctx)}
      height={h}
      onClick={(p) => {
        const d = p.data as Datum | undefined;
        if (d?.id) onSelect(d.id);
      }}
    />
  );
}

export function SerieChart({ node, escuro }: { node: Node; escuro: boolean }) {
  const t = tokens(escuro);
  const serie = node.serie ?? [];
  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      backgroundColor: t.tooltipBg,
      borderColor: t.grade,
      textStyle: { color: t.texto },
      valueFormatter: (v) => formatBRL(Number(v)),
    },
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: serie.map((s) => String(s.ano)),
      axisLabel: { color: t.textoSuave },
      axisLine: { lineStyle: { color: t.grade } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: t.textoSuave, formatter: (v: number) => formatBRL(v).replace("R$ ", "") },
      splitLine: { lineStyle: { color: t.grade } },
    },
    series: [{ type: "line", data: serie.map((s) => s.valor), showSymbol: false, lineStyle: { width: 2, color: "#2563eb" }, areaStyle: { opacity: 0.08 } }],
  };
  const ult = serie.at(-1);
  return (
    <Chart
      option={option}
      height={200}
      label={`Série histórica de ${node.nome}, ${serie[0]?.ano}–${ult?.ano}, valores nominais. Último valor: ${ult ? formatBRL(ult.valor) : ""}.`}
    />
  );
}
