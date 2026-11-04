import type { Esfera, Meta, Modo, Unidade } from "../types";
import { useApp } from "../store/useApp";
import { Segmented } from "./ui";

export function TopBar({ meta }: { meta?: Meta }) {
  const { modo, esfera, uf, unidade, tema, setModo, setEsfera, setUf, setUnidade, toggleTema, setDrawer, setGlossario } = useApp();
  const ufs = meta?.ufs ?? [];
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm lg:hidden dark:border-slate-700"
            aria-label="Abrir árvore de navegação"
          >
            ☰ Árvore
          </button>
          <div>
            <h1 className="text-lg font-bold leading-tight">Orçamento Brasil 2025</h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">Para onde vai e de onde vem o dinheiro público</p>
          </div>
        </div>

        <Segmented<Modo>
          label="Modo"
          value={modo}
          onChange={setModo}
          options={[
            { value: "despesas", label: "Despesas" },
            { value: "receitas", label: "Receitas" },
            { value: "saldo", label: "Saldo", disabled: esfera === "municipios" || esfera === "comparar",
              title: "Compara receita e despesa onde o item existe nos dois lados (ex.: RGPS)" },
          ]}
        />

        <div className="flex flex-wrap items-end gap-2">
          <Segmented<Esfera>
            label="Esfera"
            value={esfera}
            onChange={(e) => {
              if (e === "comparar" && modo === "saldo") setModo("despesas");
              if (e === "municipios" && modo === "saldo") setModo("despesas");
              setEsfera(e);
            }}
            options={[
              { value: "uniao", label: "União" },
              { value: "estados", label: "Estados (agregado)" },
              { value: "estado", label: "Estado" },
              { value: "municipios", label: "Municípios" },
              { value: "comparar", label: "Comparar estados" },
            ]}
          />
          {esfera === "estado" && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">UF</span>
              <select
                value={uf}
                onChange={(e) => setUf(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {ufs.map((u) => (
                  <option key={u.sigla} value={u.sigla}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <Segmented<Unidade>
          label="Unidade"
          value={unidade}
          onChange={setUnidade}
          options={[
            { value: "reais", label: "R$" },
            { value: "pct_total", label: "% do total" },
            { value: "pct_pib", label: "% do PIB", disabled: esfera === "comparar",
              title: esfera === "comparar" ? "PIB por estado não disponível nesta versão" : undefined },
            { value: "per_capita", label: "Per capita" },
          ]}
        />

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGlossario(true)}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Glossário
          </button>
          <button
            type="button"
            onClick={toggleTema}
            aria-label={tema === "escuro" ? "Usar tema claro" : "Usar tema escuro"}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {tema === "escuro" ? "☀ Claro" : "☾ Escuro"}
          </button>
        </div>
      </div>
    </header>
  );
}
