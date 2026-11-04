import type { EChartsOption } from "echarts";
import type { GeoJSON } from "../../lib/data";
import type { SaldoItem } from "../../types";
import { formatBRL } from "../../lib/format";
import { Chart } from "./Chart";
import { echarts, esc, tokens } from "./echarts";

export interface UfValor {
  uf: string;
  nome: string;
  valor: number; // na unidade escolhida
  rotulo: string; // valor formatado
}

let mapaRegistrado = false;

export function BrasilMap({ geo, dados, escuro, titulo, onSelect }: {
  geo: GeoJSON;
  dados: UfValor[];
  escuro: boolean;
  titulo: string;
  onSelect?: (uf: string) => void;
}) {
  if (!mapaRegistrado) {
    echarts.registerMap("BR_UF", geo as never);
    mapaRegistrado = true;
  }
  const t = tokens(escuro);
  const vals = dados.map((d) => d.valor).filter(Number.isFinite);
  const porUf = new Map(dados.map((d) => [d.uf, d]));
  const option: EChartsOption = {
    tooltip: {
      trigger: "item",
      backgroundColor: t.tooltipBg,
      borderColor: t.grade,
      textStyle: { color: t.texto },
      formatter: (p: unknown) => {
        const d = porUf.get((p as { name: string }).name);
        return d ? `<strong>${esc(d.nome)}</strong><br/>${esc(d.rotulo)}` : "dado não disponível";
      },
    },
    visualMap: {
      min: vals.length ? Math.min(...vals) : 0,
      max: vals.length ? Math.max(...vals) : 1,
      left: 8,
      bottom: 8,
      calculable: true,
      orient: "vertical",
      itemHeight: 120,
      textStyle: { color: t.textoSuave },
      inRange: { color: escuro ? ["#1e3a5f", "#60a5fa", "#dbeafe"] : ["#dbeafe", "#3b82f6", "#1e3a8a"] },
      formatter: (v: unknown) => {
        const n = Number(v);
        const d = dados.find((x) => x.valor === n);
        return d ? d.rotulo : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n);
      },
    },
    series: [
      {
        type: "map",
        map: "BR_UF",
        nameProperty: "name",
        roam: false,
        itemStyle: { borderColor: escuro ? "#0f172a" : "#ffffff", borderWidth: 0.8 },
        emphasis: { label: { show: true, color: t.texto }, itemStyle: { areaColor: "#f59e0b" } },
        label: { show: false },
        data: dados.map((d) => ({ name: d.uf, value: d.valor })),
      },
    ],
  };
  const top = [...dados].sort((a, b) => b.valor - a.valor).slice(0, 3);
  return (
    <Chart
      option={option}
      height={440}
      label={`Mapa do Brasil por UF: ${titulo}. Maiores: ${top.map((d) => `${d.nome} ${d.rotulo}`).join("; ")}.`}
      onClick={(p) => p.name && onSelect?.(p.name)}
    />
  );
}

export function RankingChart({ dados, escuro, titulo, onSelect }: {
  dados: UfValor[];
  escuro: boolean;
  titulo: string;
  onSelect?: (uf: string) => void;
}) {
  const t = tokens(escuro);
  const ord = [...dados].filter((d) => Number.isFinite(d.valor)).sort((a, b) => a.valor - b.valor);
  const option: EChartsOption = {
    tooltip: {
      trigger: "item",
      backgroundColor: t.tooltipBg,
      borderColor: t.grade,
      textStyle: { color: t.texto },
      formatter: (p: unknown) => {
        const d = ord[(p as { dataIndex: number }).dataIndex];
        return d ? `<strong>${esc(d.nome)}</strong><br/>${esc(d.rotulo)}` : "";
      },
    },
    grid: { left: 8, right: 90, top: 4, bottom: 4, containLabel: true },
    xAxis: { type: "value", show: false },
    yAxis: {
      type: "category",
      data: ord.map((d) => d.uf),
      axisLabel: { color: t.texto, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        data: ord.map((d) => d.valor),
        barMaxWidth: 16,
        itemStyle: { color: "#2563eb" },
        label: {
          show: true,
          position: "right",
          color: t.textoSuave,
          fontSize: 10,
          formatter: (p: unknown) => ord[(p as { dataIndex: number }).dataIndex]?.rotulo ?? "",
        },
      },
    ],
  };
  return (
    <Chart
      option={option}
      height={27 * 18 + 20}
      label={`Ranking das UFs: ${titulo}.`}
      onClick={(p) => p.name && onSelect?.(p.name)}
    />
  );
}

export function SaldoChart({ itens, escuro }: { itens: SaldoItem[]; escuro: boolean }) {
  const t = tokens(escuro);
  const nomes = itens.map((i) => i.nome);
  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: t.tooltipBg,
      borderColor: t.grade,
      textStyle: { color: t.texto },
      valueFormatter: (v) => formatBRL(Number(v)),
    },
    legend: { data: ["Receita", "Despesa", "Saldo"], textStyle: { color: t.texto }, top: 0 },
    grid: { left: 8, right: 24, top: 32, bottom: 8, containLabel: true },
    xAxis: {
      type: "value",
      axisLabel: { color: t.textoSuave, formatter: (v: number) => formatBRL(v).replace("R$ ", "") },
      splitLine: { lineStyle: { color: t.grade } },
    },
    yAxis: {
      type: "category",
      data: nomes,
      inverse: true,
      axisLabel: { color: t.texto, width: 170, overflow: "truncate" },
    },
    series: [
      { name: "Receita", type: "bar", data: itens.map((i) => i.receita), itemStyle: { color: t.receita }, barMaxWidth: 14 },
      { name: "Despesa", type: "bar", data: itens.map((i) => i.despesa), itemStyle: { color: t.despesa }, barMaxWidth: 14 },
      {
        name: "Saldo",
        type: "bar",
        data: itens.map((i) => i.saldo),
        itemStyle: { color: "#64748b" },
        barMaxWidth: 14,
      },
    ],
  };
  return (
    <Chart
      option={option}
      height={Math.max(220, itens.length * 70 + 50)}
      label={`Receita, despesa e saldo: ${itens.map((i) => `${i.nome}: saldo ${formatBRL(i.saldo)}`).join("; ")}.`}
    />
  );
}
