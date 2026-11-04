"""Cliente mínimo e com cache para a API de dados abertos do Siconfi (Tesouro Nacional).

Documentação: https://apidatalake.tesouro.gov.br/docs/siconfi/
Cada resposta é salva em data_raw/siconfi/ para que o pipeline possa ser refeito sem rede.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from urllib.parse import quote

import requests

API = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt"
ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data_raw" / "siconfi"

EXERCICIO = 2025
PERIODO = 6  # 6º bimestre = ano fechado

# Página pública do Siconfi para citar como fonte na UI.
URL_PUBLICA = "https://siconfi.tesouro.gov.br/siconfi/pages/public/consulta_finbra_rreo/finbra_rreo_list.jsf"


def api_url(anexo: str, id_ente: int, exercicio: int = EXERCICIO, periodo: int = PERIODO) -> str:
    if anexo.startswith("DCA"):
        return f"{API}/dca?an_exercicio={exercicio}&no_anexo={quote(anexo)}&id_ente={id_ente}"
    return (
        f"{API}/rreo?an_exercicio={exercicio}&nr_periodo={periodo}"
        f"&co_tipo_demonstrativo=RREO&no_anexo={quote(anexo)}&id_ente={id_ente}"
    )


def _cache_path(anexo: str, id_ente: int, exercicio: int, periodo: int) -> Path:
    if anexo.startswith("DCA"):
        slug = anexo.replace(" ", "").replace("-", "_")
        return CACHE / f"{exercicio}_dca" / slug / f"{id_ente}.json"
    slug = anexo.replace("RREO-", "").replace(" ", "")
    return CACHE / f"{exercicio}_{periodo}" / slug / f"{id_ente}.json"


def rreo(anexo: str, id_ente: int, exercicio: int = EXERCICIO, periodo: int = PERIODO,
         session: requests.Session | None = None, offline: bool = False) -> list[dict]:
    """Retorna todas as linhas do anexo (RREO ou DCA) para o ente (com paginação e cache)."""
    path = _cache_path(anexo, id_ente, exercicio, periodo)
    if path.exists():
        return json.loads(path.read_text("utf-8"))
    if offline:
        raise FileNotFoundError(path)
    s = session or requests.Session()
    items: list[dict] = []
    offset = 0
    while True:
        url = api_url(anexo, id_ente, exercicio, periodo) + f"&offset={offset}"
        for tentativa in range(5):
            try:
                r = s.get(url, timeout=90)
                r.raise_for_status()
                data = r.json()
                break
            except (requests.RequestException, ValueError):
                if tentativa == 4:
                    raise
                time.sleep(2 ** (tentativa + 1))
        items.extend(data["items"])
        if not data.get("hasMore"):
            break
        offset += data["limit"]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(items, ensure_ascii=False), "utf-8")
    return items


def entes(session: requests.Session | None = None) -> list[dict]:
    path = CACHE / "entes.json"
    if path.exists():
        return json.loads(path.read_text("utf-8"))
    s = session or requests.Session()
    r = s.get(f"{API}/entes", timeout=90)
    r.raise_for_status()
    items = r.json()["items"]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(items, ensure_ascii=False), "utf-8")
    return items
