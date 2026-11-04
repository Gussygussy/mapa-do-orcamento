import type { SaldoItem } from "../types";
import { formatBRL } from "../lib/format";
import { useApp } from "../store/useApp";
import { SaldoChart } from "./charts/MapCharts";
import { Aviso, Termo } from "./ui";

export function SaldoView({ itens, titulo, escuro }: { itens: SaldoItem[] | undefined; titulo: string; escuro: boolean }) {
  const { setModo, select } = useApp();
  if (!itens || !itens.length) {
    return (
      <div className="p-4">
        <Aviso>Dado não disponível: não há itens com receita e despesa comparáveis para esta esfera.</Aviso>
      </div>
    );
  }
  return (
    <div className="space-y-3 p-4">
      <h2 className="text-lg font-semibold">Saldo: receita × despesa – {titulo}</h2>
      <p className="text-sm text-slate-700 dark:text-slate-300">
        Itens que existem nos dois lados do orçamento. Saldo negativo = déficit, coberto por outras receitas do Tesouro.
        Previdência: <Termo termo="rgps">RGPS</Termo>, <Termo termo="rpps">RPPS</Termo>.
      </p>
      <div className="rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        <SaldoChart itens={itens} escuro={escuro} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Receita, despesa e saldo</caption>
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs dark:border-slate-700">
              <th scope="col" className="px-1.5 py-1">Item</th>
              <th scope="col" className="px-1.5 py-1 text-right">Receita</th>
              <th scope="col" className="px-1.5 py-1 text-right">Despesa</th>
              <th scope="col" className="px-1.5 py-1 text-right">Saldo</th>
              <th scope="col" className="px-1.5 py-1">Base / fonte</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.id} className="border-b border-slate-100 align-top dark:border-slate-800">
                <td className="px-1.5 py-1">
                  {i.no ? (
                    <button
                      type="button"
                      className="text-left text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                      onClick={() => {
                        setModo(i.no!.includes(".receitas") ? "receitas" : "despesas");
                        select(i.no!);
                      }}
                    >
                      {i.nome}
                    </button>
                  ) : (
                    i.nome
                  )}
                  {i.nota && <div className="text-xs text-slate-600 dark:text-slate-400">{i.nota}</div>}
                </td>
                <td className="whitespace-nowrap px-1.5 py-1 text-right tabular-nums">{formatBRL(i.receita)}</td>
                <td className="whitespace-nowrap px-1.5 py-1 text-right tabular-nums">{formatBRL(i.despesa)}</td>
                <td className={"whitespace-nowrap px-1.5 py-1 text-right font-semibold tabular-nums " + (i.saldo < 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400")}>
                  {formatBRL(i.saldo)}
                </td>
                <td className="px-1.5 py-1 text-xs">
                  {i.base} ·{" "}
                  {i.fonte.map((f) => (
                    <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="underline">
                      {f.nome}
                    </a>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => setModo("despesas")} className="text-sm text-blue-700 underline dark:text-blue-300">
        Voltar às despesas
      </button>
    </div>
  );
}
