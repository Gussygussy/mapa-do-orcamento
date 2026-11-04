"""Valida os JSON de public/data/. Sai com código 1 se alguma regra inegociável for violada.

Regras (CLAUDE.md):
- todo nó tem id, nome, valor numérico, `base` válida e pelo menos uma `fonte` com nome e url;
- todo indicador tem fonte;
- filhos somam ao pai: se a soma passar do pai em mais de 1%, falha; se ficar abaixo, precisa
  existir o nó "Outros / não detalhado";
- valores calculados (nó "Outros") vêm marcados com estimado: true;
- números de referência (seed.py) conferem com o que o pipeline produziu.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import seed

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data"
BASES = {"empenhado", "liquidado", "pago", "caixa", "arrecadado"}

erros: list[str] = []
avisos: list[str] = []


def erro(msg: str) -> None:
    erros.append(msg)


def checar_fonte(f: object, onde: str) -> None:
    if not isinstance(f, dict) or not f.get("nome") or not str(f.get("url", "")).startswith("http"):
        erro(f"{onde}: fonte inválida {f!r}")


def checar_no(n: dict, arq: str, ids: set[str], pai: dict | None = None) -> int:
    onde = f"{arq}:{n.get('id')}"
    for campo in ("id", "nome", "valor", "base", "fonte"):
        if campo not in n:
            erro(f"{onde}: sem campo '{campo}'")
            return 0
    if not isinstance(n["valor"], (int, float)):
        erro(f"{onde}: valor não numérico")
    if n["base"] not in BASES:
        erro(f"{onde}: base inválida '{n['base']}'")
    if not n["fonte"]:
        erro(f"{onde}: sem fonte")
    for f in n["fonte"]:
        checar_fonte(f, onde)
    if n["id"] in ids:
        erro(f"{onde}: id duplicado")
    ids.add(n["id"])
    if pai is not None and not n["id"].startswith(pai["id"] + "."):
        erro(f"{onde}: id não começa com o id do pai ({pai['id']})")
    for k, ind in (n.get("indicadores") or {}).items():
        if "valor" not in ind or "unidade" not in ind:
            erro(f"{onde}: indicador {k} incompleto")
        checar_fonte(ind.get("fonte"), f"{onde} indicador {k}")
    if n["id"].endswith(".outros") and not n.get("estimado"):
        erro(f"{onde}: nó 'Outros' deve ter estimado: true")
    filhos = n.get("filhos") or []
    total = 1
    if filhos:
        soma = sum(f["valor"] for f in filhos)
        tol = max(0.1, abs(n["valor"]) * 0.0005) + 0.05 * len(filhos)  # arredondamento a 0,1
        if soma > n["valor"] * 1.01 + tol:
            erro(f"{onde}: filhos somam {soma:,.1f} > pai {n['valor']:,.1f} (+{100 * (soma / n['valor'] - 1):.1f}%)")
        elif n["valor"] - soma > tol and not any(f["id"].endswith(".outros") for f in filhos):
            erro(f"{onde}: filhos somam {soma:,.1f} < pai {n['valor']:,.1f} e não há 'Outros / não detalhado'")
        bases_filhos = {f["base"] for f in filhos}
        if bases_filhos - {n["base"]}:
            avisos.append(f"{onde}: filhos em base diferente ({', '.join(sorted(bases_filhos))} × {n['base']}) – a UI mostra aviso")
        for f in filhos:
            total += checar_no(f, arq, ids, n)
    return total


def expandir(c: dict, prefixo: str, base: str, fonte: dict) -> dict:
    """Formato compacto dos municípios -> Node completo (mesma regra de src/lib/municipio.ts)."""
    id_ = f"{prefixo}.{c['s']}"
    n = {"id": id_, "nome": c["n"], "valor": c["v"], "base": base, "fonte": [fonte]}
    if c.get("e"):
        n["estimado"] = True
    if c.get("c"):
        n["filhos"] = [expandir(f, id_, base, fonte) for f in c["c"]]
    return n


def carregar(nome: str) -> dict:
    return json.loads((DATA / nome).read_text("utf-8"))


def achar(n: dict, id_: str) -> dict | None:
    if n["id"] == id_:
        return n
    for f in n.get("filhos") or []:
        if id_ == f["id"] or id_.startswith(f["id"] + "."):
            r = achar(f, id_)
            if r:
                return r
    return None


def perto(rotulo: str, obtido: float, esperado: float, tol_pct: float = 1.0, so_aviso: bool = False,
          casas_bi: int = 1) -> None:
    """Compara em R$ mi. Aceita a diferença se estiver dentro de tol_pct OU se o valor do pipeline,
    arredondado como a referência foi publicada (casas_bi decimais em R$ bi), for igual a ela."""
    dif = 100 * (obtido / esperado - 1) if esperado else 0
    msg = f"{rotulo}: pipeline {obtido:,.1f} × referência {esperado:,.1f} ({dif:+.2f}%)"
    igual_arredondado = round(obtido / 1e3, casas_bi) == round(esperado / 1e3, casas_bi)
    if abs(dif) > tol_pct and not igual_arredondado:
        (avisos.append if so_aviso else erro)(msg)
    else:
        print(f"  ok  {msg}")


def main() -> None:
    arquivos = ["uniao_despesas.json", "uniao_receitas.json", "estados_despesas.json", "estados_receitas.json",
                "municipios_despesas.json", "municipios_receitas.json"]
    contagem = 0
    for a in arquivos:
        contagem += checar_no(carregar(a), a, set())
    for p in sorted((DATA / "estados").glob("*.json")):
        d = json.loads(p.read_text("utf-8"))
        for chave in ("despesas", "receitas"):
            contagem += checar_no(d[chave], f"estados/{p.name}", set())
    n_ufs = len(list((DATA / "estados").glob("*.json")))
    if n_ufs != 27:
        erro(f"esperava 27 arquivos em estados/, achei {n_ufs}")
    for p in sorted((DATA / "municipios_uf").glob("*.json")):
        d = json.loads(p.read_text("utf-8"))
        for chave in ("despesas", "receitas"):
            if d[chave]:
                contagem += checar_no(d[chave], f"municipios_uf/{p.name}", set())
    # Municípios: formato compacto, expandido como o app faz (src/lib/municipio.ts)
    n_mun = 0
    for p in sorted((DATA / "municipios").glob("*.json")):
        d = json.loads(p.read_text("utf-8"))
        n_mun += 1
        for chave, base in (("despesas", "empenhado"), ("receitas", "arrecadado")):
            if d[chave]:
                contagem += checar_no(expandir(d[chave], f"m{d['cod']}", base, d["fontes"][chave]),
                                      f"municipios/{p.name}", set())
    indice = carregar("municipios_index.json")
    com_dados = sum(1 for m in indice if m[4] or m[5])
    if com_dados != n_mun:
        erro(f"municipios_index.json marca {com_dados} municípios com dados, mas há {n_mun} arquivos")

    meta = carregar("meta.json")
    saldo = carregar("saldo.json")
    for esfera, itens in saldo.items():
        for it in itens:
            for f in it["fonte"]:
                checar_fonte(f, f"saldo.json:{esfera}.{it['id']}")
            if abs(it["receita"] - it["despesa"] - it["saldo"]) > 0.15:
                erro(f"saldo.json:{esfera}.{it['id']}: saldo não fecha")

    print("Checagens de referência (seed.py):")
    ud = carregar("uniao_despesas.json")
    # Funções da União: CONORF inclui intraorçamentárias; Encargos Especiais tem diferença conhecida.
    for nome, bi in seed.CONORF_FUNCOES_BI.items():
        n = next((f for f in ud["filhos"] if f["nome"] == nome), None)
        if n is None:
            erro(f"função {nome} ausente em uniao_despesas")
            continue
        perto(f"União/{nome}", n["valor"], bi * 1e3, tol_pct=1.5,
              so_aviso=nome in ("Encargos Especiais", "Desporto e Lazer", "Indústria"))
    perto("União/total da despesa", ud["valor"], seed.CONORF_TOTAL_BI * 1e3, so_aviso=True)

    ur = carregar("uniao_receitas.json")
    perto("União/receita total nominal (RTN)", ur["valor"], 2902.3e3, tol_pct=0.1)
    perto("União/receita líquida nominal (RTN)", ur["indicadores"]["receita_liquida"]["valor"], 2332.6e3, tol_pct=0.1)

    rgps = achar(ud, "uniao.despesas.previdencia_social.previdencia_basica")
    assert rgps is not None
    ri = rgps["indicadores"]
    perto("RGPS/despesa total (caixa)", ri["despesa_caixa"]["valor"], 1026.9e3, 0.1)
    perto("RGPS/arrecadação", ri["arrecadacao"]["valor"], 709.7e3, 0.1)
    perto("RGPS/déficit", ri["deficit"]["valor"], -317.2e3, 0.1)
    perto("RGPS/benefícios urbanos", achar(rgps, rgps["id"] + ".urbano")["valor"], 768.3e3, 0.1)
    perto("RGPS/benefícios rurais", achar(rgps, rgps["id"] + ".rural")["valor"], 209.7e3, 0.1)
    if sum(seed.BEPS_FAIXAS.values()) != seed.BEPS_TOTAL or seed.BEPS_URBANO + seed.BEPS_RURAL != seed.BEPS_TOTAL:
        erro("BEPS: faixas ou clientelas não somam o total")

    pi = achar(ud, "uniao.despesas.previdencia_social")["indicadores"]
    perto("RPPS civil/despesa", pi["rpps_civil_despesa"]["valor"], 105.1e3, 0.2)
    perto("RPPS civil/déficit", pi["rpps_civil_deficit"]["valor"], -62.6e3, 0.2, so_aviso=True)
    perto("Militares/despesa", pi["militares_despesa"]["valor"], 62.6e3, 0.2)
    perto("Militares/déficit", pi["militares_deficit"]["valor"], -53.0e3, 0.2)
    perto("FCDF/despesa", pi["fcdf_despesa"]["valor"], 5.1e3, 1.5)

    perto("PIB 2025 (RTN atual × CLAUDE.md)", meta["pib"]["valor"], seed.PIB_2025, tol_pct=0.1)

    er = carregar("estados_receitas.json")
    icms = achar(er, "estados.receitas.correntes.impostos_taxas_e_contribuicoes_de_melhoria.icms")
    print(f"  info ICMS bruto das 27 UFs: {icms['valor'] / 1e3:,.1f} bi (IFI, líquido da cota municipal: "
          f"{seed.IFI_RECEITAS_BI['ICMS']:,.1f} bi)")
    mun = meta["municipios"]
    for chave in ("despesas", "receitas"):
        print(f"  info municípios ({chave}): {mun[f'{chave}_com_dados']}/{mun['entes_total']} entes, "
              f"{mun[f'{chave}_pct_populacao']}% da população")
        if mun[f"{chave}_pct_populacao"] < 90:
            avisos.append(f"cobertura municipal baixa em {chave}: {mun[f'{chave}_pct_populacao']}% da população")

    print(f"\n{contagem} nós verificados; {len(avisos)} avisos; {len(erros)} erros")
    for a in avisos:
        print("  AVISO", a)
    for e in erros:
        print("  ERRO ", e)
    sys.exit(1 if erros else 0)


if __name__ == "__main__":
    main()
