// usa a build ESM (a build CommonJS em lib/ quebra o default export no Vite)
import ReactEChartsCore from "echarts-for-react/esm/core";
import type { EChartsOption } from "echarts";
import { echarts } from "./echarts";

interface Props {
  option: EChartsOption;
  /** descrição textual para leitores de tela */
  label: string;
  height?: number | string;
  onClick?: (params: { data?: unknown; name?: string }) => void;
}

/** Envoltório fino do ECharts com papel de imagem e descrição acessível. */
export function Chart({ option, label, height = 420, onClick }: Props) {
  return (
    <div role="img" aria-label={label} className="w-full">
      <ReactEChartsCore
        echarts={echarts}
        option={{ aria: { enabled: true }, ...option }}
        notMerge
        lazyUpdate
        style={{ height, width: "100%" }}
        onEvents={onClick ? { click: onClick } : undefined}
        opts={{ renderer: "canvas" }}
      />
    </div>
  );
}
