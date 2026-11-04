"""Baixa do Siconfi o RREO 2025 (6º bimestre) da União e das UFs e a DCA 2025 dos municípios.

Uso:
    python scripts/fetch_siconfi.py uniao        # União: anexos 01, 02, 04.2, 04.3, 04.4
    python scripts/fetch_siconfi.py estados      # 26 estados + DF: anexos 01, 02, 03, 04
    python scripts/fetch_siconfi.py municipios   # 5.570 municípios: DCA 2025 Anexos I-E (despesa) e I-C (receita), ~1 h
    python scripts/fetch_siconfi.py tudo

Os downloads ficam em data_raw/siconfi/ (cache). Rodar de novo só baixa o que falta.
Para municípios usa-se a DCA (Declaração de Contas Anuais) 2025, Anexo I-E (despesa por função e
subfunção), porque cerca de 1/3 deles não tem o RREO do 6º bimestre na API. Quem não enviou a DCA
fica com lista vazia e entra na contagem de cobertura.
"""
from __future__ import annotations

import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

import siconfi

ANEXOS_COMPLETOS = ["RREO-Anexo 01", "RREO-Anexo 02", "RREO-Anexo 03", "RREO-Anexo 04"]
ANEXOS_UNIAO = ["RREO-Anexo 01", "RREO-Anexo 02", "RREO-Anexo 04.2", "RREO-Anexo 04.3", "RREO-Anexo 04.4 - RGPS"]


def baixar(lista: list[tuple[str, int]], workers: int = 6) -> None:
    s = requests.Session()
    falhas: list[tuple[str, int, str]] = []
    feitos = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(siconfi.rreo, anexo, ente, session=s): (anexo, ente) for anexo, ente in lista}
        for f in as_completed(futs):
            anexo, ente = futs[f]
            feitos += 1
            try:
                f.result()
            except Exception as e:  # noqa: BLE001 - registrar e seguir
                falhas.append((anexo, ente, str(e)[:120]))
            if feitos % 200 == 0:
                print(f"  {feitos}/{len(lista)} ({len(falhas)} falhas)", flush=True)
    print(f"Concluído: {feitos - len(falhas)}/{len(lista)} ok")
    for anexo, ente, msg in falhas[:20]:
        print(f"  FALHA {anexo} {ente}: {msg}")
    if falhas:
        print("Rode de novo para tentar baixar as falhas (o cache guarda o que já veio).")


def main(alvo: str) -> None:
    entes = siconfi.entes()
    ufs = [e["cod_ibge"] for e in entes if e["esfera"] in ("E", "D")]
    muns = [e["cod_ibge"] for e in entes if e["esfera"] == "M"]
    tarefas: list[tuple[str, int]] = []
    if alvo in ("uniao", "tudo"):
        tarefas += [(a, 1) for a in ANEXOS_UNIAO]
    if alvo in ("estados", "tudo"):
        tarefas += [(a, u) for u in ufs for a in ANEXOS_COMPLETOS]
    if alvo in ("municipios", "tudo"):
        tarefas += [(a, m) for m in muns for a in ("DCA-Anexo I-E", "DCA-Anexo I-C")]
    print(f"Baixando {len(tarefas)} demonstrativos…")
    baixar(tarefas)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "tudo")
