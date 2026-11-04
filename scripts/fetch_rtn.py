"""Baixa a série histórica do Resultado do Tesouro Nacional (RTN) e extrai a Tabela 2.2 (anual, R$ milhões correntes).

Fonte: Tesouro Transparente (CKAN), conjunto "resultado-do-tesouro-nacional".
O nome do arquivo XLSX muda a cada mês, por isso a URL é descoberta pela API do CKAN.
Saída: data_raw/rtn/rtn_anual.json  {"anos": [...], "linhas": {"<rótulo>": {"<ano>": valor}}}
"""
from __future__ import annotations

import json
from pathlib import Path

import openpyxl
import requests

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data_raw" / "rtn"
CKAN = "https://www.tesourotransparente.gov.br/ckan/api/3/action/package_show?id=resultado-do-tesouro-nacional"
PAGINA = "https://www.tesourotransparente.gov.br/ckan/dataset/resultado-do-tesouro-nacional"


def url_xlsx() -> str:
    r = requests.get(CKAN, timeout=60)
    r.raise_for_status()
    for res in r.json()["result"]["resources"]:
        if "Série Histórica" in res["name"] and res["url"].endswith(".xlsx"):
            return res["url"]
    raise RuntimeError("planilha do RTN não encontrada no CKAN")


def main() -> dict:
    RAW.mkdir(parents=True, exist_ok=True)
    xlsx = RAW / "rtn.xlsx"
    meta = RAW / "rtn_url.txt"
    if not xlsx.exists():
        url = url_xlsx()
        r = requests.get(url, timeout=300)
        r.raise_for_status()
        xlsx.write_bytes(r.content)
        meta.write_text(url)
    url = meta.read_text().strip() if meta.exists() else PAGINA
    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
    rows = list(wb["2.2"].iter_rows(values_only=True))
    hdr_idx = next(i for i, r in enumerate(rows) if r[0] == "Discriminação")
    anos = [int(a) for a in rows[hdr_idx][1:] if isinstance(a, (int, float))]
    linhas: dict[str, dict[str, float]] = {}
    for r in rows[hdr_idx + 1:]:
        if not r[0] or not isinstance(r[1], (int, float)):
            continue
        rotulo = " ".join(str(r[0]).split())
        if rotulo in linhas:  # rótulos repetidos (memorando): mantém o primeiro
            continue
        linhas[rotulo] = {str(a): float(v) for a, v in zip(anos, r[1:]) if isinstance(v, (int, float))}
    # Tabela 2.2-A (% do PIB): permite derivar o PIB nominal usado pelo Tesouro
    rows_pct = list(wb["2.2-A"].iter_rows(values_only=True))
    hp = next(i for i, r in enumerate(rows_pct) if r[0] == "Discriminação")
    anos_pct = list(rows_pct[hp])
    pct_receita = {}
    for r in rows_pct[hp + 1:]:
        if r[0] and str(r[0]).startswith("1. RECEITA TOTAL"):
            pct_receita = {str(int(a)): float(v) for a, v in zip(anos_pct[1:], r[1:])
                           if isinstance(a, (int, float)) and isinstance(v, (int, float))}
            break
    out = {"anos": anos, "linhas": linhas, "receita_total_pct_pib": pct_receita,
           "fonte": {"nome": "Tesouro Nacional – Resultado do Tesouro Nacional (RTN), série histórica",
                     "url": url, "tabela": "Tabela 2.2 – Resultado Primário do Governo Central – Anual – Valores Correntes"}}
    (RAW / "rtn_anual.json").write_text(json.dumps(out, ensure_ascii=False), "utf-8")
    rt = linhas["1. RECEITA TOTAL 1/"]["2025"]
    print(f"RTN: {len(linhas)} linhas, {anos[0]}–{anos[-1]}; receita total 2025 = {rt:,.1f} mi")
    return out


if __name__ == "__main__":
    main()
