import type { Node } from "../types";

export function Breadcrumb({ path, onSelect }: { path: Node[]; onSelect: (id: string) => void }) {
  return (
    <nav aria-label="Caminho até o item selecionado">
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {path.map((n, i) => {
          const ultimo = i === path.length - 1;
          return (
            <li key={n.id} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden="true" className="text-slate-400">›</span>}
              {ultimo ? (
                <span aria-current="page" className="font-semibold">
                  {n.nome}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(n.id)}
                  className="rounded text-blue-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-300"
                >
                  {n.nome}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
