import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { GLOSSARIO, type TermoGlossario } from "../lib/glossario";

export function Segmented<T extends string>({ label, value, options, onChange, hideLabel }: {
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean; title?: string }[];
  onChange: (v: T) => void;
  hideLabel?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className={hideLabel ? "sr-only" : "text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400"}>
        {label}
      </span>
      <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-lg bg-slate-200/70 p-0.5 dark:bg-slate-800">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            disabled={o.disabled}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={
              "rounded-md px-2.5 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40 " +
              (value === o.value
                ? "bg-white font-semibold text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white"
                : "text-slate-700 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-700")
            }
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const BADGE = {
  azul: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  ambar: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  cinza: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  verde: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
};

export function Badge({ children, cor = "cinza", title }: { children: ReactNode; cor?: keyof typeof BADGE; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[cor]}`}>
      {children}
    </span>
  );
}

export function EstimativaBadge() {
  return (
    <Badge cor="ambar" title="Valor calculado, não lido diretamente de uma fonte oficial">
      estimativa
    </Badge>
  );
}

/** Ícone "?" com a definição do termo do glossário. */
export function Termo({ termo, children }: { termo: TermoGlossario; children?: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const g = GLOSSARIO[termo]!;
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as globalThis.Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);
  return (
    <span ref={ref} className="relative inline-flex items-center gap-1">
      {children}
      <button
        type="button"
        aria-label={`O que é ${g.termo}?`}
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-bold leading-none text-slate-600 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        ?
      </button>
      {aberto && (
        <span
          id={id}
          role="note"
          className="absolute left-0 top-6 z-30 w-64 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs font-normal normal-case leading-relaxed text-slate-800 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          <strong className="block text-sm">{g.termo}</strong>
          {g.definicao}
        </span>
      )}
    </span>
  );
}

export function Card({ titulo, valor, detalhe, children }: { titulo: ReactNode; valor: ReactNode; detalhe?: ReactNode; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs text-slate-600 dark:text-slate-400">{titulo}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{valor}</div>
      {detalhe && <div className="text-xs text-slate-600 dark:text-slate-400">{detalhe}</div>}
      {children}
    </div>
  );
}

export function Aviso({ children, tipo = "info" }: { children: ReactNode; tipo?: "info" | "alerta" }) {
  const cls =
    tipo === "alerta"
      ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
      : "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100";
  return (
    <div role={tipo === "alerta" ? "alert" : "note"} className={`rounded-lg border p-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}

export function Secao({ titulo, children, acoes }: { titulo: ReactNode; children: ReactNode; acoes?: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{titulo}</h3>
        {acoes}
      </div>
      {children}
    </section>
  );
}

export function Carregando({ texto = "Carregando dados…" }: { texto?: string }) {
  return (
    <p role="status" className="p-4 text-sm text-slate-600 dark:text-slate-400">
      {texto}
    </p>
  );
}
