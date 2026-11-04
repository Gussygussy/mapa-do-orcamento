import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Node } from "../types";
import { formatPct } from "../lib/format";
import { formatMetric, type UnitCtx } from "../lib/units";
import { parentOf, pathTo, searchTree, visibleNodes } from "../lib/tree";

interface Props {
  root: Node;
  selectedId: string;
  ctx: UnitCtx;
  onSelect: (id: string) => void;
}

function Destaque({ texto, busca }: { texto: string; busca: string }) {
  if (!busca.trim()) return <>{texto}</>;
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const i = norm(texto).indexOf(norm(busca.trim()));
  if (i < 0) return <>{texto}</>;
  const n = busca.trim().length;
  return (
    <>
      {texto.slice(0, i)}
      <mark className="rounded bg-amber-200 px-0.5 text-inherit dark:bg-amber-700">{texto.slice(i, i + n)}</mark>
      {texto.slice(i + n)}
    </>
  );
}

export function TreeNav({ root, selectedId, ctx, onSelect }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([root.id]));
  const [busca, setBusca] = useState("");
  const [focusId, setFocusId] = useState(selectedId);
  const listRef = useRef<HTMLUListElement>(null);

  // abre o caminho até o nó selecionado
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(root.id);
      for (const n of pathTo(root, selectedId)) next.add(n.id);
      return next;
    });
    setFocusId(selectedId);
  }, [root, selectedId]);

  const resultado = useMemo(() => searchTree(root, busca), [root, busca]);
  const buscando = busca.trim().length > 0;
  const efetivoExpandido = buscando ? resultado.visible : expanded;
  const linhas = useMemo(
    () => visibleNodes(root, efetivoExpandido, buscando ? resultado.visible : undefined),
    [root, efetivoExpandido, buscando, resultado.visible],
  );

  const focar = (id: string) => {
    setFocusId(id);
    const el = () => listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);
    const agora = el();
    // item já renderizado: foca na hora (teclas rápidas não se perdem); senão, após o render
    if (agora) agora.focus();
    else requestAnimationFrame(() => el()?.focus());
  };

  const toggle = (id: string, abrir?: boolean) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      const vaiAbrir = abrir ?? !next.has(id);
      if (vaiAbrir) next.add(id);
      else next.delete(id);
      return next;
    });

  const onKey = (e: KeyboardEvent<HTMLElement>, n: Node, idx: number) => {
    const temFilhos = !!n.filhos?.length;
    const aberto = efetivoExpandido.has(n.id);
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (linhas[idx + 1]) focar(linhas[idx + 1]!.node.id);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (linhas[idx - 1]) focar(linhas[idx - 1]!.node.id);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (temFilhos && !aberto) toggle(n.id, true);
        else if (temFilhos && linhas[idx + 1]) focar(linhas[idx + 1]!.node.id);
        break;
      case "ArrowLeft": {
        e.preventDefault();
        if (temFilhos && aberto && !buscando) toggle(n.id, false);
        else {
          const p = parentOf(root, n.id);
          if (p) focar(p.id);
        }
        break;
      }
      case "Home":
        e.preventDefault();
        focar(linhas[0]!.node.id);
        break;
      case "End":
        e.preventDefault();
        focar(linhas[linhas.length - 1]!.node.id);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        onSelect(n.id);
        if (temFilhos) toggle(n.id, true);
        break;
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-3 dark:border-slate-800">
        <label htmlFor="busca-arvore" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
          Buscar na árvore
        </label>
        <input
          id="busca-arvore"
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="ex.: rural, ICMS, Atenção Básica"
          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        {buscando && (
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400" role="status">
            {resultado.matches.size === 0
              ? "Nenhum item encontrado."
              : `${resultado.matches.size} ${resultado.matches.size === 1 ? "item encontrado" : "itens encontrados"}`}
          </p>
        )}
      </div>
      <ul ref={listRef} role="tree" aria-label={`Árvore: ${root.nome}`} className="flex-1 overflow-auto py-1 text-sm">
        {linhas.map(({ node: n, level }, idx) => {
          const temFilhos = !!n.filhos?.length;
          const aberto = efetivoExpandido.has(n.id);
          const sel = n.id === selectedId;
          const pai = parentOf(root, n.id);
          const pct = pai && pai.valor ? (100 * n.valor) / pai.valor : null;
          const casa = resultado.matches.has(n.id);
          return (
            <li
              key={n.id}
              role="treeitem"
              data-id={n.id}
              aria-level={level}
              aria-expanded={temFilhos ? aberto : undefined}
              aria-selected={sel}
              tabIndex={n.id === focusId ? 0 : -1}
              onKeyDown={(e) => onKey(e, n, idx)}
              onFocus={() => setFocusId(n.id)}
              onClick={() => {
                onSelect(n.id);
                setFocusId(n.id);
                if (temFilhos && !aberto) toggle(n.id, true);
              }}
              className={
                "group flex cursor-pointer items-center gap-1 py-1 pr-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 " +
                (sel
                  ? "bg-blue-100 font-semibold text-blue-950 dark:bg-blue-950 dark:text-blue-100"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800") +
                (casa && !sel ? " bg-amber-50 dark:bg-amber-950/30" : "")
              }
              style={{ paddingLeft: `${(level - 1) * 14 + 6}px` }}
            >
              <span
                aria-hidden="true"
                onClick={(e) => {
                  if (!temFilhos) return;
                  e.stopPropagation();
                  toggle(n.id);
                }}
                className={"inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs text-slate-500 " + (temFilhos ? "hover:bg-slate-200 dark:hover:bg-slate-700" : "")}
              >
                {temFilhos ? (aberto ? "▾" : "▸") : "·"}
              </span>
              <span className="min-w-0 flex-1 truncate" title={n.nome}>
                <Destaque texto={n.nome} busca={busca} />
                {n.estimado && <span className="ml-1 text-[10px] font-normal text-amber-700 dark:text-amber-400">(est.)</span>}
              </span>
              <span className="shrink-0 text-right text-xs tabular-nums text-slate-600 dark:text-slate-400">
                {formatMetric(n.valor, ctx)}
                {pct !== null && <span className="ml-1 hidden text-[10px] sm:inline">{formatPct(pct)}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
