"""Baixa e lê o "Resultado do RGPS – dezembro/2025 – urbano e rural" (Ministério da Previdência Social).

Extrai o quadro-resumo anual (R$ milhões nominais) com `pdftotext -layout` (poppler-utils).
Saída: data_raw/mps/rgps_2025.json
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data_raw" / "mps"
URL = ("https://www.gov.br/previdencia/pt-br/assuntos/previdencia-social/resultados-do-rgps/2025/"
       "resultado-do-rgps-2025-12-urbano-rural.pdf")

# rótulo no PDF -> chave
LINHAS = {
    "1. Arrecadação Líquida Total": "arrecadacao",
    "1.1 Urbana": "arrecadacao_urbana",
    "1.2 Rural": "arrecadacao_rural",
    "1.3 Comprev": "arrecadacao_comprev",
    "2. Despesa com Benefícios": "despesa",
    "2.1 Benefícios Previdenciários": "beneficios",
    "2.1.1 Urbano": "beneficios_urbanos",
    "2.1.2 Rural": "beneficios_rurais",
    "2.2 Passivo Judicial": "passivo_judicial",
    "2.2.1 Urbano": "passivo_urbano",
    "2.2.2 Rural": "passivo_rural",
    "2.3 Comprev": "comprev",
    "3.1 Urbano": "resultado_urbano",
    "3.2 Rural": "resultado_rural",
}


def _num(s: str) -> float:
    neg = s.startswith("(")
    v = float(s.strip("()").replace(".", "").replace(",", "."))
    return -v if neg else v


def main() -> dict:
    RAW.mkdir(parents=True, exist_ok=True)
    pdf = RAW / "rgps_2025_12.pdf"
    if not pdf.exists():
        r = requests.get(URL, timeout=120)
        r.raise_for_status()
        pdf.write_bytes(r.content)
    txt = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True, text=True, check=True).stdout
    # O quadro-resumo anual é o bloco "EM R$ MILHÕES NOMINAIS" que traz a linha "2.1.1 Urbano"
    blocos = txt.split("EM R$ MILHÕES NOMINAIS")[1:]
    bloco = next(b for b in blocos if "2.1.1 Urbano" in b and "3.2 Rural" in b)
    out: dict[str, float] = {}
    for linha in bloco.splitlines():
        s = linha.strip()
        for rotulo, chave in LINHAS.items():
            if s.startswith(rotulo) and chave not in out:
                m = re.findall(r"\(?[\d.]+,\d\)?", s[len(rotulo):])
                if m:
                    out[chave] = _num(m[-1])
                break
    faltando = set(LINHAS.values()) - set(out)
    assert not faltando, f"linhas não encontradas no PDF: {faltando}"
    # checagens internas do próprio quadro
    assert abs(out["beneficios_urbanos"] + out["beneficios_rurais"] - out["beneficios"]) < 1
    assert abs(out["beneficios"] + out["passivo_judicial"] + out["comprev"] - out["despesa"]) < 1
    res = {"valores_milhoes": out, "fonte": {"nome": "MPS – Resultado do RGPS dez/2025 (urbano e rural)", "url": URL}}
    (RAW / "rgps_2025.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), "utf-8")
    print("RGPS 2025:", {k: round(v / 1e3, 1) for k, v in out.items()})
    return res


if __name__ == "__main__":
    main()
