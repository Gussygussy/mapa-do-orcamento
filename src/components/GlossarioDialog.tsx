import { useEffect, useRef } from "react";
import { GLOSSARIO } from "../lib/glossario";
import { useApp } from "../store/useApp";

export function GlossarioDialog() {
  const { glossarioOpen, setGlossario } = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (glossarioOpen && !d.open) d.showModal?.();
    if (!glossarioOpen && d.open) d.close();
  }, [glossarioOpen]);
  return (
    <dialog
      ref={ref}
      onClose={() => setGlossario(false)}
      aria-labelledby="glossario-titulo"
      className="m-auto max-h-[85vh] w-[min(640px,calc(100%-32px))] rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-black/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h2 id="glossario-titulo" className="text-lg font-semibold">Glossário</h2>
        <button type="button" onClick={() => setGlossario(false)} className="rounded-md px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
          Fechar
        </button>
      </div>
      <dl className="space-y-3 overflow-auto px-4 py-3 text-sm">
        {Object.values(GLOSSARIO).map((g) => (
          <div key={g.termo}>
            <dt className="font-semibold">{g.termo}</dt>
            <dd className="text-slate-700 dark:text-slate-300">{g.definicao}</dd>
          </div>
        ))}
      </dl>
    </dialog>
  );
}
