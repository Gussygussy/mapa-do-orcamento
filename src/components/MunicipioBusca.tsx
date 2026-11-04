import { useEffect, useMemo, useState } from "react";
import type { MunicipioIndice } from "../lib/municipio";
import { rotuloMunicipio } from "../lib/municipio";

function normaliza(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Campo com sugestões (datalist nativo: acessível e leve) para escolher entre os 5.570 municípios. */
export function MunicipioBusca({ indice, codAtual, onEscolher }: {
  indice: MunicipioIndice[] | undefined;
  codAtual: number | null;
  onEscolher: (cod: number) => void;
}) {
  const atual = indice?.find((m) => m[0] === codAtual);
  const [texto, setTexto] = useState(atual ? rotuloMunicipio(atual) : "");
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (atual) setTexto(rotuloMunicipio(atual));
  }, [atual]);
  const porRotulo = useMemo(() => new Map((indice ?? []).map((m) => [normaliza(rotuloMunicipio(m)), m])), [indice]);

  const tentar = (v: string) => {
    const m = porRotulo.get(normaliza(v));
    if (m) {
      setErro(null);
      onEscolher(m[0]);
      return true;
    }
    return false;
  };

  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">Município</span>
      <input
        id="busca-municipio"
        list="lista-municipios"
        value={texto}
        placeholder={indice ? "ex.: Campinas (SP)" : "Carregando lista…"}
        disabled={!indice}
        autoComplete="off"
        aria-describedby={erro ? "busca-municipio-erro" : undefined}
        onChange={(e) => {
          setTexto(e.target.value);
          tentar(e.target.value); // escolha numa sugestão dispara change com o texto completo
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (tentar(texto)) return;
          // aceita o nome sem a UF quando ele é único
          const q = normaliza(texto);
          const achados = (indice ?? []).filter((m) => normaliza(m[1]) === q);
          if (achados.length === 1) {
            setTexto(rotuloMunicipio(achados[0]!));
            tentar(rotuloMunicipio(achados[0]!));
          } else
            setErro(
              achados.length > 1
                ? `Há ${achados.length} municípios com esse nome. Escolha na lista, com a UF.`
                : "Município não encontrado. Escolha um nome da lista.",
            );
        }}
        className="w-64 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
      />
      <datalist id="lista-municipios">
        {indice?.map((m) => (
          <option key={m[0]} value={rotuloMunicipio(m)} />
        ))}
      </datalist>
      {erro && (
        <span id="busca-municipio-erro" role="alert" className="text-xs text-red-700 dark:text-red-400">
          {erro}
        </span>
      )}
    </label>
  );
}
