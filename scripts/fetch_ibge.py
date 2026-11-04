"""Baixa do IBGE a população estimada de 2025 (UFs e municípios) e a malha das UFs.

Fontes (FTP público do IBGE; a API servicodados.ibge.gov.br estava instável e não é usada):
- Estimativas da população, 1º/jul/2025 (DOU):
  https://ftp.ibge.gov.br/Estimativas_de_Populacao/Estimativas_2025/estimativa_dou_2025.xls
- Malha territorial das UFs 2025 (shapefile):
  https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2025/Brasil/BR_UF_2025.zip

Saídas:
- data_raw/ibge/populacao_2025.json  {"uf": {"SP": ...}, "municipios": {"3550308": ...}, "brasil": ...}
- public/data/geo/br_uf.json         GeoJSON simplificado (propriedades: sigla, nome, cod_ibge)
"""
from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path

import requests
import shapefile  # pyshp
import xlrd
from shapely.geometry import mapping, shape

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data_raw" / "ibge"
URL_POP = "https://ftp.ibge.gov.br/Estimativas_de_Populacao/Estimativas_2025/estimativa_dou_2025.xls"
URL_MALHA = ("https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/"
             "malhas_municipais/municipio_2025/Brasil/BR_UF_2025.zip")

UF_NOME_SIGLA = {
    "Rondônia": "RO", "Acre": "AC", "Amazonas": "AM", "Roraima": "RR", "Pará": "PA", "Amapá": "AP",
    "Tocantins": "TO", "Maranhão": "MA", "Piauí": "PI", "Ceará": "CE", "Rio Grande do Norte": "RN",
    "Paraíba": "PB", "Pernambuco": "PE", "Alagoas": "AL", "Sergipe": "SE", "Bahia": "BA",
    "Minas Gerais": "MG", "Espírito Santo": "ES", "Rio de Janeiro": "RJ", "São Paulo": "SP",
    "Paraná": "PR", "Santa Catarina": "SC", "Rio Grande do Sul": "RS", "Mato Grosso do Sul": "MS",
    "Mato Grosso": "MT", "Goiás": "GO", "Distrito Federal": "DF",
}


def baixar(url: str, destino: Path) -> Path:
    if destino.exists():
        return destino
    r = requests.get(url, timeout=300)
    r.raise_for_status()
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(r.content)
    return destino


def _num(v: object) -> int:
    # Algumas células trazem notas, ex.: "12.345(1)"
    if isinstance(v, (int, float)):
        return int(v)
    s = str(v).split("(")[0].replace(".", "").replace(",", "").strip()
    return int(s)


def populacao() -> dict:
    wb = xlrd.open_workbook(str(baixar(URL_POP, RAW / "pop2025.xls")))
    ufs: dict[str, int] = {}
    brasil = 0
    s = wb.sheet_by_name("BRASIL E UFs")
    for r in range(s.nrows):
        nome, valor = s.row_values(r)[:2]
        nome = str(nome).strip()
        if nome == "Brasil":
            brasil = _num(valor)
        elif nome in UF_NOME_SIGLA:
            ufs[UF_NOME_SIGLA[nome]] = _num(valor)
    muns: dict[str, int] = {}
    s = wb.sheet_by_name("Municípios")
    for r in range(2, s.nrows):
        row = s.row_values(r)
        if not row[1] or not str(row[2]).strip():
            continue
        try:
            cm = row[2]
            # a coluna vem como texto ("00015") em parte do arquivo e como número (10508.0) em outra
            cm = f"{int(cm):05d}" if isinstance(cm, float) else str(cm).strip()
            cod = f"{int(row[1]):02d}{cm}"
            if len(cod) != 7:
                continue
            muns[cod] = _num(row[4])
        except (ValueError, TypeError):
            continue
    assert len(ufs) == 27, f"esperava 27 UFs, achei {len(ufs)}"
    assert abs(sum(ufs.values()) - brasil) < 10, "soma das UFs não bate com o Brasil"
    assert abs(sum(muns.values()) - brasil) < 10, "soma dos municípios não bate com o Brasil"
    out = {"brasil": brasil, "uf": ufs, "municipios": muns,
           "fonte": {"nome": "IBGE – Estimativas da população residente, 1º/jul/2025", "url": URL_POP}}
    (RAW / "populacao_2025.json").write_text(json.dumps(out, ensure_ascii=False), "utf-8")
    print(f"População: Brasil {brasil:,}; {len(ufs)} UFs; {len(muns)} municípios")
    return out


def malha() -> None:
    z = zipfile.ZipFile(io.BytesIO(baixar(URL_MALHA, RAW / "BR_UF_2025.zip").read_bytes()))
    nomes = {Path(n).suffix.lower(): n for n in z.namelist()}
    sf = shapefile.Reader(shp=io.BytesIO(z.read(nomes[".shp"])), dbf=io.BytesIO(z.read(nomes[".dbf"])),
                          shx=io.BytesIO(z.read(nomes[".shx"])), encoding="utf-8")
    campos = [f[0] for f in sf.fields[1:]]
    feats = []
    for rec, shp in zip(sf.records(), sf.shapes()):
        props = dict(zip(campos, rec))
        geom = shape(shp.__geo_interface__).simplify(0.02, preserve_topology=True)
        gj = mapping(geom)
        # arredonda coordenadas para reduzir tamanho
        gj = json.loads(json.dumps(gj), parse_float=lambda x: round(float(x), 3))
        feats.append({"type": "Feature",
                      "properties": {"name": props["SIGLA_UF"], "nome": props["NM_UF"],
                                     "cod_ibge": int(props["CD_UF"])},
                      "geometry": gj})
    out = ROOT / "public" / "data" / "geo" / "br_uf.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":")), "utf-8")
    print(f"Malha: {len(feats)} UFs, {out.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    populacao()
    malha()
