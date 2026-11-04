import type { Node, Visualizacao } from "../types";
import type { UnitCtx } from "../lib/units";
import { useApp } from "../store/useApp";
import { Breadcrumb } from "./Breadcrumb";
import { BarsChart, NegativosAviso, SunburstChart, TreemapChart } from "./charts/NodeCharts";
import { Segmented } from "./ui";

export function VizPanel({ root, node, path, parent, ctx, escuro, onSelect }: {
  root: Node;
  node: Node;
  path: Node[];
  parent?: Node;
  ctx: UnitCtx;
  escuro: boolean;
  onSelect: (id: string) => void;
}) {
  const { viz, setViz } = useApp();
  // Se o nó é folha, mostramos os irmãos com ele destacado.
  const alvo = node.filhos?.length ? node : parent ?? root;
  const highlight = node.filhos?.length ? undefined : node.id;
  const props = { node: alvo, ctx, escuro, onSelect, highlight };
  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Breadcrumb path={path} onSelect={onSelect} />
        <Segmented<Visualizacao>
          label="Visualização"
          hideLabel
          value={viz}
          onChange={setViz}
          options={[
            { value: "treemap", label: "Treemap" },
            { value: "sunburst", label: "Sunburst" },
            { value: "barras", label: "Barras" },
          ]}
        />
      </div>
      {!node.filhos?.length && (
        <p className="text-xs text-slate-600 dark:text-slate-400">
          “{node.nome}” não tem subdivisões; mostrando os itens de “{alvo.nome}”.
        </p>
      )}
      <p className="text-xs text-slate-600 dark:text-slate-400">Clique num bloco para ver o detalhe e descer um nível.</p>
      <div className="rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {/* key: nova instância a cada nó, senão o ECharts deixa rótulos antigos na transição */}
        {viz === "treemap" && <TreemapChart key={alvo.id} {...props} />}
        {viz === "sunburst" && <SunburstChart key={alvo.id} {...props} />}
        {viz === "barras" && <BarsChart key={alvo.id} {...props} />}
      </div>
      <NegativosAviso node={alvo} />
    </div>
  );
}
