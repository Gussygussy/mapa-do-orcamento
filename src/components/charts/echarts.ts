// Registro modular do ECharts: só os gráficos usados entram no bundle.
import * as echarts from "echarts/core";
import { BarChart, LineChart, MapChart, SunburstChart, TreemapChart } from "echarts/charts";
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent, VisualMapComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  TreemapChart,
  SunburstChart,
  BarChart,
  LineChart,
  MapChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  VisualMapComponent,
  AriaComponent,
  CanvasRenderer,
]);

export { echarts };

/** Paleta categórica com bom contraste nos dois temas. */
export const PALETA = [
  "#2563eb", "#16a34a", "#d97706", "#9333ea", "#dc2626", "#0891b2", "#65a30d", "#db2777",
  "#4f46e5", "#ca8a04", "#0d9488", "#ea580c", "#7c3aed", "#059669", "#e11d48", "#0284c7",
];

export function tokens(escuro: boolean) {
  return {
    texto: escuro ? "#e2e8f0" : "#0f172a",
    textoSuave: escuro ? "#94a3b8" : "#475569",
    borda: escuro ? "#0f172a" : "#ffffff",
    grade: escuro ? "#334155" : "#e2e8f0",
    tooltipBg: escuro ? "#1e293b" : "#ffffff",
    receita: "#16a34a",
    despesa: "#dc2626",
  };
}

/** Escapa texto para os tooltips HTML do ECharts. */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
