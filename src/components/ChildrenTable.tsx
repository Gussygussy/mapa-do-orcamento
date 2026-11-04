import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import type { Node } from "../types";
import { formatPct } from "../lib/format";
import { formatMetric, type UnitCtx } from "../lib/units";
import { isOutros } from "../lib/tree";

interface Linha {
  id: string;
  nome: string;
  valor: number;
  pct: number;
  base: string;
  fonte: string;
  url: string;
  estimado: boolean;
}

const col = createColumnHelper<Linha>();

export function ChildrenTable({ node, ctx, onSelect }: { node: Node; ctx: UnitCtx; onSelect: (id: string) => void }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "valor", desc: true }]);
  const [filtro, setFiltro] = useState("");
  const dados = useMemo<Linha[]>(
    () =>
      (node.filhos ?? []).map((f) => ({
        id: f.id,
        nome: f.nome,
        valor: f.valor,
        pct: node.valor ? (100 * f.valor) / node.valor : NaN,
        base: f.base,
        fonte: f.fonte[0]?.nome ?? "",
        url: f.fonte[0]?.url ?? "",
        estimado: !!f.estimado || isOutros(f),
      })),
    [node],
  );
  const colunas = useMemo(
    () => [
      col.accessor("nome", {
        header: "Item",
        cell: (c) => (
          <button
            type="button"
            onClick={() => onSelect(c.row.original.id)}
            className="text-left text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
          >
            {c.getValue()}
            {c.row.original.estimado && <span className="ml-1 text-[10px] text-amber-700 dark:text-amber-400">(estimativa)</span>}
          </button>
        ),
      }),
      col.accessor("valor", {
        header: "Valor",
        cell: (c) => <span className="tabular-nums">{formatMetric(c.getValue(), ctx)}</span>,
        meta: { num: true },
      }),
      col.accessor("pct", {
        header: "% do pai",
        cell: (c) => <span className="tabular-nums">{formatPct(c.getValue())}</span>,
        meta: { num: true },
      }),
      col.accessor("base", { header: "Base" }),
      col.accessor("fonte", {
        header: "Fonte",
        enableSorting: false,
        cell: (c) => (
          <a href={c.row.original.url} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline dark:text-blue-300" title={c.getValue()}>
            {c.getValue().length > 22 ? c.getValue().slice(0, 20) + "…" : c.getValue()}
          </a>
        ),
      }),
    ],
    [ctx, onSelect],
  );
  const tabela = useReactTable({
    data: dados,
    columns: colunas,
    state: { sorting, globalFilter: filtro },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFiltro,
    globalFilterFn: (row, _c, v: string) => row.original.nome.toLowerCase().includes(v.toLowerCase()),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (!dados.length) return <p className="text-sm text-slate-600 dark:text-slate-400">Este item não tem subdivisões.</p>;
  return (
    <div className="space-y-2">
      {dados.length > 6 && (
        <input
          type="search"
          aria-label="Filtrar itens da tabela"
          placeholder="Filtrar…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <caption className="sr-only">Subdivisões de {node.nome}</caption>
          <thead>
            {tabela.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-slate-200 dark:border-slate-700">
                {hg.headers.map((h) => {
                  const ord = h.column.getIsSorted();
                  const num = (h.column.columnDef.meta as { num?: boolean } | undefined)?.num;
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={ord === "asc" ? "ascending" : ord === "desc" ? "descending" : undefined}
                      className={"px-1.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 " + (num ? "text-right" : "text-left")}
                    >
                      {h.column.getCanSort() ? (
                        <button type="button" onClick={h.column.getToggleSortingHandler()} className="inline-flex items-center gap-0.5 hover:underline">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          <span aria-hidden="true">{ord === "asc" ? "▲" : ord === "desc" ? "▼" : ""}</span>
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {tabela.getRowModel().rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                {r.getVisibleCells().map((c) => {
                  const num = (c.column.columnDef.meta as { num?: boolean } | undefined)?.num;
                  return (
                    <td key={c.id} className={"px-1.5 py-1 align-top " + (num ? "whitespace-nowrap text-right" : "")}>
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
