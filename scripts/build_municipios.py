"""Árvores dos municípios a partir da DCA 2025 (Siconfi): despesa (Anexo I-E) e receita (Anexo I-C).

Gera em public/data/:
- municipios/<cod_ibge>.json   uma árvore por município, em formato compacto (ver `compactar`)
- municipios_uf/<UF>.json      soma dos municípios de cada UF (formato Node completo)
- municipios_despesas.json     soma de todos os municípios
- municipios_receitas.json
- municipios_index.json        lista para a busca: [cod, nome, UF, população, tem despesa, tem receita]

Chamado por build_tree.py. Municípios sem DCA ficam fora das somas e aparecem como
"dado não disponível"; a cobertura é registrada em cada agregado e em meta.json.
"""
from __future__ import annotations

import re
import shutil
from pathlib import Path
from typing import Any

import siconfi

Node = dict[str, Any]

DCA_PAGINA = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca?an_exercicio=2025&no_anexo="
PROF_RECEITA = 5  # níveis da natureza da receita: categoria, origem, espécie, desdobramento, tipo


def _bt():
    import build_tree  # import tardio: build_tree importa este módulo
    return build_tree


def fonte_dca(anexo: str, nome_ente: str | None, cod: int | None, tabela: str) -> dict:
    if cod is None:
        return {"nome": f"Siconfi/Tesouro – DCA 2025, {anexo}, municípios", "url": DCA_PAGINA + anexo.replace(" ", "%20"),
                "tabela": tabela}
    return {"nome": f"Siconfi/Tesouro – DCA 2025, {anexo}, {nome_ente}", "url": siconfi.api_url(f"DCA-{anexo}", cod),
            "tabela": tabela}


# ------------------------------------------------------------------ receitas (Anexo I-C)

def _segmentos(cod_conta: str) -> tuple[str, ...]:
    """'RO1.7.1.1.51.0.0' -> ('1','7','1','1','51')  (sem os zeros finais)"""
    segs = cod_conta[2:].split(".")
    while segs and set(segs[-1]) == {"0"}:
        segs.pop()
    return tuple(segs)


def _nome_receita(conta: str) -> str:
    s = re.sub(r"^[\d.]+\s*-\s*", "", conta).replace("¿", "–").strip()
    return s[:1].upper() + s[1:]


def receitas_dca(items: list[dict], prefixo: str, nome: str, fonte: dict) -> Node | None:
    bt = _bt()
    brutas: dict[tuple, tuple[str, float]] = {}
    total = None
    ded_fundeb = outras_ded = 0.0
    for i in items:
        c, col = i["cod_conta"], i["coluna"]
        v = bt.mi(i["valor"] or 0)
        if c == "ReceitasExcetoIntraOrcamentarias":
            if col == "Receitas Brutas Realizadas":
                total = v
            elif col.startswith("Deduções - FUNDEB"):
                ded_fundeb = v
            elif col.startswith("Outras Deduções"):
                outras_ded = v
            continue
        if not c.startswith("RO") or col != "Receitas Brutas Realizadas":
            continue
        segs = _segmentos(c)
        if 0 < len(segs) <= PROF_RECEITA and segs not in brutas:
            brutas[segs] = (_nome_receita(i["conta"]), v)
    if total is None or total <= 0:
        return None
    nos: dict[tuple, Node] = {}
    raiz = bt.node(prefixo, nome, total, "arrecadado", fonte)
    for segs in sorted(brutas, key=lambda s: (len(s), s)):
        n, v = brutas[segs]
        pai = next((nos[segs[:k]] for k in range(len(segs) - 1, 0, -1) if segs[:k] in nos), raiz)
        # id = caminho do pai + código da natureza (ex.: m3550308.receitas.n1.n1_1.n1_1_1)
        nos[segs] = bt.node(f"{pai['id']}.n{'_'.join(segs)}", n, v, "arrecadado", fonte)
        pai.setdefault("filhos", []).append(nos[segs])
    _poda_incoerente(raiz)
    raiz["indicadores"] = {
        "deducao_fundeb": bt.indicador(ded_fundeb, "R$ mi", fonte, "Dedução para formação do Fundeb (sai da receita bruta)."),
        "outras_deducoes": bt.indicador(outras_ded, "R$ mi", fonte, "Outras deduções da receita (restituições etc.)."),
        "receita_liquida": bt.indicador(total - ded_fundeb - outras_ded, "R$ mi", fonte,
                                        "Receita após as deduções (bruta − Fundeb − outras deduções)."),
    }
    raiz["nota"] = ("Receitas brutas realizadas em 2025, exceto intraorçamentárias, pela natureza da receita. "
                    "A dedução para o Fundeb aparece nos indicadores.")
    return raiz


def _poda_incoerente(n: Node) -> None:
    """Se a soma dos filhos passa do pai em mais de 1% (dado incoerente na fonte), mantém o pai sem detalhe."""
    filhos = n.get("filhos") or []
    for f in filhos:
        _poda_incoerente(f)
    filhos = [f for f in filhos if abs(f["valor"]) >= 0.05]
    if filhos and sum(f["valor"] for f in filhos) > n["valor"] * 1.01 + 0.05:
        n.pop("filhos", None)
        n["nota"] = "O detalhamento enviado pelo município não fecha com o total; mostrado sem subdivisões."
    elif filhos:
        n["filhos"] = filhos
    else:
        n.pop("filhos", None)


# ------------------------------------------------------------------ formato compacto

def compactar(n: Node) -> dict:
    """Node -> {n: nome, v: valor, s: último segmento do id, c: filhos, e: estimado, t: nota}.

    O app reconstrói id (prefixo + s), base, fonte e o texto das notas de "Outros"."""
    d: dict[str, Any] = {"n": n["nome"], "v": n["valor"], "s": n["id"].rsplit(".", 1)[-1]}
    if n.get("filhos"):
        d["c"] = [compactar(f) for f in n["filhos"]]
    if n.get("estimado"):
        d["e"] = 1
    if n.get("nota") and not n["id"].endswith(".outros"):
        d["t"] = n["nota"]
    return d


# ------------------------------------------------------------------ principal

def construir(pop: dict, out: Path) -> dict:
    bt = _bt()
    entes = [e for e in siconfi.entes() if e["esfera"] == "M"]
    pasta = out / "municipios"
    if pasta.exists():
        shutil.rmtree(pasta)
    pasta.mkdir(parents=True)

    f_desp_ag = fonte_dca("Anexo I-E", None, None, "Despesas empenhadas por função e subfunção, exceto intraorçamentárias")
    f_rec_ag = fonte_dca("Anexo I-C", None, None, "Receitas brutas realizadas, exceto intraorçamentárias")
    por_uf: dict[str, dict[str, list[Node]]] = {}
    indice = []
    cobertura_uf: dict[str, dict[str, int]] = {}
    pop_cob = {"despesas": 0, "receitas": 0}
    for e in sorted(entes, key=lambda x: x["cod_ibge"]):
        cod, uf, nome = e["cod_ibge"], e["uf"], e["ente"]
        p = pop["municipios"].get(str(cod), 0)
        cob = cobertura_uf.setdefault(uf, {"total": 0, "despesas": 0, "receitas": 0, "pop": 0, "pop_desp": 0, "pop_rec": 0})
        cob["total"] += 1
        cob["pop"] += p
        pref = f"m{cod}"
        desp = rec = None
        try:
            itens_d = siconfi.rreo("DCA-Anexo I-E", cod, offline=True)
        except FileNotFoundError:
            itens_d = []
        if itens_d:
            total, funcs = bt.funcoes_dca(itens_d)
            if total > 0:
                f = fonte_dca("Anexo I-E", nome, cod, "Despesas empenhadas por função e subfunção, exceto intraorçamentárias")
                desp = bt.fechar(bt.arvore_funcoes(f"{pref}.despesas", f"Despesas – {nome} ({uf})", total, funcs, f), 3)
        try:
            itens_r = siconfi.rreo("DCA-Anexo I-C", cod, offline=True)
        except FileNotFoundError:
            itens_r = []
        if itens_r:
            f = fonte_dca("Anexo I-C", nome, cod, "Receitas brutas realizadas, exceto intraorçamentárias")
            r = receitas_dca(itens_r, f"{pref}.receitas", f"Receitas – {nome} ({uf})", f)
            rec = bt.fechar(r, 3) if r else None
        grupos = por_uf.setdefault(uf, {"despesas": [], "receitas": []})
        if desp:
            grupos["despesas"].append(desp)
            cob["despesas"] += 1
            cob["pop_desp"] += p
            pop_cob["despesas"] += p
        if rec:
            grupos["receitas"].append(rec)
            cob["receitas"] += 1
            cob["pop_rec"] += p
            pop_cob["receitas"] += p
        indice.append([cod, nome, uf, p, 1 if desp else 0, 1 if rec else 0])
        if desp or rec:
            bt.write(pasta / f"{cod}.json", {
                "cod": cod, "nome": nome, "uf": uf, "pop": p,
                "fontes": {"despesas": desp["fonte"][0] if desp else None, "receitas": rec["fonte"][0] if rec else None},
                "despesas": compactar(desp) if desp else None,
                "receitas": compactar(rec) if rec else None,
            })

    # Agregados por UF
    nomes_uf = {sig: nm for sig, nm in bt.UFS.values()}
    ag_uf: dict[str, dict[str, Node]] = {}
    pasta_uf = out / "municipios_uf"
    pasta_uf.mkdir(parents=True, exist_ok=True)
    for uf, grupos in sorted(por_uf.items()):
        cob = cobertura_uf[uf]
        res: dict[str, Any] = {"uf": uf, "nome": nomes_uf[uf], "cobertura": cob}
        for chave, fonte, rotulo in (("despesas", f_desp_ag, "Despesas"), ("receitas", f_rec_ag, "Receitas")):
            arvs = grupos[chave]
            if not arvs:
                res[chave] = None
                continue
            pop_cob_uf = cob["pop_desp"] if chave == "despesas" else cob["pop_rec"]
            pct_pop = 100 * pop_cob_uf / cob["pop"] if cob["pop"] else 0
            res[chave] = bt.somar(arvs, f"m-{uf}", f"{rotulo} dos municípios – {nomes_uf[uf]}", [fonte],
                                  f"Soma das contas anuais (DCA 2025) de {cob[chave]} dos {cob['total']} municípios de "
                                  f"{nomes_uf[uf]} ({pct_fmt(pct_pop)} da população). Quem não enviou a DCA fica de fora.")
        ag_uf[uf] = res
        bt.write(pasta_uf / f"{uf}.json", res)

    # Brasil
    total_m = len(entes)
    cobertura = {"entes_total": total_m}
    nacionais = {}
    for chave, fonte, rotulo in (("despesas", f_desp_ag, "Despesas"), ("receitas", f_rec_ag, "Receitas")):
        arvs = [g[chave] for g in ag_uf.values() if g[chave]]
        n_com = sum(c[chave] for c in cobertura_uf.values())
        pct_e = round(100 * n_com / total_m, 1)
        pct_p = round(100 * pop_cob[chave] / pop["brasil"], 1)
        raiz = bt.somar(arvs, "municipios", f"{rotulo} dos municípios (agregado)", [fonte],
                        f"Soma das contas anuais (DCA 2025) de {n_com:,} dos {total_m:,} municípios ({pct_e}% dos entes, "
                        f"{pct_p}% da população). Quem não enviou a DCA fica de fora; o total real é um pouco maior."
                        .replace(",", "."))
        nacionais[chave] = raiz
        cobertura[f"{chave}_com_dados"] = n_com
        cobertura[f"{chave}_pct_entes"] = pct_e
        cobertura[f"{chave}_pct_populacao"] = pct_p
    nacionais["despesas"].setdefault("indicadores", {})["deficit_atuarial_rpps"] = bt.indicador(
        -bt.seed.AEPS_DEFICIT_ATUARIAL_RPPS_MUN_BI * 1e3, "R$ mi", bt.seed.AEPS,
        "Déficit ATUARIAL dos RPPS municipais (valor presente de compromissos futuros), não é gasto anual.")
    bt.write(out / "municipios_despesas.json", nacionais["despesas"])
    bt.write(out / "municipios_receitas.json", nacionais["receitas"])
    bt.write(out / "municipios_index.json", indice)

    # compatibilidade com os campos usados antes em meta.json
    cobertura.update({"entes_com_dados": cobertura["despesas_com_dados"], "pct_entes": cobertura["despesas_pct_entes"],
                      "pct_populacao": cobertura["despesas_pct_populacao"]})
    return {"cobertura": cobertura, "por_uf": ag_uf, "nacionais": nacionais}


def pct_fmt(v: float) -> str:
    return f"{v:.1f}%".replace(".", ",")
