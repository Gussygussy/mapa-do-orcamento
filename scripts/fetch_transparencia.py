"""Baixa a execução da despesa da União em 2025 por ação (Portal da Transparência, download em lote).

Não precisa de chave: usa os arquivos mensais "Despesas – execução" da página de download de dados
(https://portaldatransparencia.gov.br/download-de-dados/despesas-execucao), que redireciona para
https://dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/despesas-execucao/AAAAMM_Despesas.zip

Cada arquivo traz os valores lançados NO MÊS; o ano é a soma de jan a dez.
Saída: data_raw/transparencia/acoes_2025.csv com totais por função, subfunção, programa e ação
(empenhado, liquidado e pago, em R$).
"""
from __future__ import annotations

import io
import zipfile
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data_raw" / "transparencia"
URL = "https://dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/despesas-execucao/{am}_Despesas.zip"
PAGINA = "https://portaldatransparencia.gov.br/download-de-dados/despesas-execucao"

CHAVES = ["Código Função", "Nome Função", "Código Subfução", "Nome Subfunção",
          "Código Programa Orçamentário", "Nome Programa Orçamentário", "Código Ação", "Nome Ação"]
VALORES = ["Valor Empenhado (R$)", "Valor Liquidado (R$)", "Valor Pago (R$)"]


def baixar(am: str) -> Path:
    z = RAW / f"{am}_Despesas.zip"
    if not z.exists():
        r = requests.get(URL.format(am=am), timeout=600)
        r.raise_for_status()
        RAW.mkdir(parents=True, exist_ok=True)
        z.write_bytes(r.content)
    return z


def ler_mes(z: Path) -> pd.DataFrame:
    with zipfile.ZipFile(z) as zf:
        nome = next(n for n in zf.namelist() if n.lower().endswith(".csv"))
        with zf.open(nome) as f:
            df = pd.read_csv(io.TextIOWrapper(f, encoding="latin-1"), sep=";", dtype=str,
                             usecols=CHAVES + VALORES)
    for c in VALORES:
        df[c] = pd.to_numeric(df[c].str.replace(".", "", regex=False).str.replace(",", ".", regex=False))
    return df.groupby(CHAVES, dropna=False, as_index=False)[VALORES].sum()


def main() -> None:
    partes = []
    for m in range(1, 13):
        am = f"2025{m:02d}"
        df = ler_mes(baixar(am))
        print(f"{am}: {len(df):,} combinações; empenhado no mês R$ {df[VALORES[0]].sum() / 1e9:,.1f} bi")
        partes.append(df)
    tot = pd.concat(partes).groupby(CHAVES, dropna=False, as_index=False)[VALORES].sum()
    tot.columns = ["cod_funcao", "funcao", "cod_subfuncao", "subfuncao", "cod_programa", "programa",
                   "cod_acao", "acao", "empenhado", "liquidado", "pago"]
    out = RAW / "acoes_2025.csv"
    tot.to_csv(out, index=False)
    print(f"Total 2025: {len(tot):,} ações; empenhado R$ {tot['empenhado'].sum() / 1e9:,.1f} bi -> {out}")


if __name__ == "__main__":
    main()
