"""Monta as árvores JSON finais em public/data/ a partir dos dados baixados em data_raw/.

Pré-requisito (uma vez, com rede):
    python scripts/fetch_siconfi.py tudo
    python scripts/fetch_rtn.py
    python scripts/fetch_mps.py
    python scripts/fetch_ibge.py

Depois:
    python scripts/build_tree.py && python scripts/validate.py

Convenções (ver CLAUDE.md):
- valores em R$ milhões nominais de 2025;
- todo nó tem `fonte` e `base`;
- quando a soma dos filhos é menor que o pai, entra um nó "Outros / não detalhado" com a diferença.
"""
from __future__ import annotations

import json
import re
import unicodedata
from datetime import date
from pathlib import Path
from typing import Any, Iterable

import seed
import siconfi

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data_raw"
OUT = ROOT / "public" / "data"

Node = dict[str, Any]

COL_EMPENHADO = "DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)"
COL_LIQUIDADO = "DESPESAS LIQUIDADAS ATÉ O BIMESTRE (d)"

FUNCOES = {
    "01": "Legislativa", "02": "Judiciária", "03": "Essencial à Justiça", "04": "Administração",
    "05": "Defesa Nacional", "06": "Segurança Pública", "07": "Relações Exteriores",
    "08": "Assistência Social", "09": "Previdência Social", "10": "Saúde", "11": "Trabalho",
    "12": "Educação", "13": "Cultura", "14": "Direitos da Cidadania", "15": "Urbanismo",
    "16": "Habitação", "17": "Saneamento", "18": "Gestão Ambiental", "19": "Ciência e Tecnologia",
    "20": "Agricultura", "21": "Organização Agrária", "22": "Indústria", "23": "Comércio e Serviços",
    "24": "Comunicações", "25": "Energia", "26": "Transporte", "27": "Desporto e Lazer",
    "28": "Encargos Especiais", "99": "Reserva de Contingência",
}
NOMES_FUNCOES = set(FUNCOES.values())

UFS = {
    11: ("RO", "Rondônia"), 12: ("AC", "Acre"), 13: ("AM", "Amazonas"), 14: ("RR", "Roraima"),
    15: ("PA", "Pará"), 16: ("AP", "Amapá"), 17: ("TO", "Tocantins"), 21: ("MA", "Maranhão"),
    22: ("PI", "Piauí"), 23: ("CE", "Ceará"), 24: ("RN", "Rio Grande do Norte"), 25: ("PB", "Paraíba"),
    26: ("PE", "Pernambuco"), 27: ("AL", "Alagoas"), 28: ("SE", "Sergipe"), 29: ("BA", "Bahia"),
    31: ("MG", "Minas Gerais"), 32: ("ES", "Espírito Santo"), 33: ("RJ", "Rio de Janeiro"),
    35: ("SP", "São Paulo"), 41: ("PR", "Paraná"), 42: ("SC", "Santa Catarina"),
    43: ("RS", "Rio Grande do Sul"), 50: ("MS", "Mato Grosso do Sul"), 51: ("MT", "Mato Grosso"),
    52: ("GO", "Goiás"), 53: ("DF", "Distrito Federal"),
}


# ---------------------------------------------------------------- utilitários

def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "_", s.lower()).strip("_")
    return s or "item"


def mi(v: float) -> float:
    """reais -> R$ milhões"""
    return v / 1e6


def fonte_siconfi(ente: str, anexo: str, ente_id: int, tabela: str | None = None) -> dict:
    f = {"nome": f"Siconfi/Tesouro – {anexo} 2025, {ente}", "url": siconfi.api_url(anexo, ente_id)}
    if tabela:
        f["tabela"] = tabela
    return f


def indicador(valor: float, unidade: str, fonte: dict, nota: str | None = None,
              estimado: bool = False) -> dict:
    d: dict[str, Any] = {"valor": round(valor, 1) if unidade == "R$ mi" else valor, "unidade": unidade,
                         "fonte": fonte}
    if nota:
        d["nota"] = nota
    if estimado:
        d["estimado"] = True
    return d


def node(id_: str, nome: str, valor: float, base: str, fonte: list[dict] | dict, **kw: Any) -> Node:
    n: Node = {"id": id_, "nome": nome, "valor": valor, "base": base,
               "fonte": fonte if isinstance(fonte, list) else [fonte]}
    for k, v in kw.items():
        if v is not None:
            n[k] = v
    return n


def fechar(n: Node) -> Node:
    """Arredonda, ordena filhos e cria "Outros / não detalhado" quando a soma é menor que o pai."""
    filhos = n.get("filhos")
    if filhos:
        for f in filhos:
            fechar(f)
        filhos.sort(key=lambda f: (f["id"].endswith(".outros"), -f["valor"]))
        soma = sum(f["valor"] for f in filhos)
        dif = n["valor"] - soma
        tol = max(0.05, abs(n["valor"]) * 0.0005)
        if dif > tol and not any(f["id"].endswith(".outros") for f in filhos):
            filhos.append(node(
                f"{n['id']}.outros", "Outros / não detalhado", dif, n["base"], n["fonte"],
                estimado=True,
                nota="Diferença entre o total e a soma dos itens detalhados (calculada).",
            ))
    n["valor"] = round(n["valor"], 1)
    return n


def podar(filhos: Iterable[Node]) -> list[Node]:
    """remove itens com valor zero (|v| < R$ 50 mil) para não poluir a árvore"""
    return [f for f in filhos if abs(f["valor"]) >= 0.05]


def write(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), "utf-8")


# ------------------------------------------------- despesa por função (RREO 02 e DCA I-E)

def _nome_sub(conta: str) -> str:
    m = re.match(r"FU\d{2} - (.*)", conta)
    if m:
        s = m.group(1)
        return "Demais subfunções" if s.lower().startswith("demais") else s
    return conta


def funcoes_rreo(items: list[dict], incluir_intra: bool, coluna: str = COL_EMPENHADO) -> tuple[float, dict]:
    """Lê o RREO Anexo 02. Retorna (total, {função: {"valor", "subs": {sub: valor}}}) em R$ mi."""
    rotulos = {"Total das Despesas Exceto Intra-Orçamentárias"}
    if incluir_intra:
        rotulos.add("Total das Despesas Intra-Orçamentárias")
    funcs: dict[str, dict] = {}
    total = 0.0
    for rot in rotulos:
        atual: str | None = None
        for i in items:
            if i["rotulo"] != rot or i["coluna"] != coluna:
                continue
            conta = i["conta"].strip()
            v = mi(i["valor"] or 0)
            if conta.startswith(("DESPESAS (EXCETO", "DESPESAS (INTRA", "TOTAL (III)")):
                if (rot.startswith("Total das Despesas Exceto") and conta.startswith("DESPESAS (EXCETO")) or \
                        (rot.startswith("Total das Despesas Intra") and conta.startswith("DESPESAS (INTRA")):
                    total += v
                atual = None
                continue
            if conta in NOMES_FUNCOES:
                atual = conta
                f = funcs.setdefault(conta, {"valor": 0.0, "subs": {}})
                f["valor"] += v
            elif atual:
                sub = _nome_sub(conta)
                subs = funcs[atual]["subs"]
                subs[sub] = subs.get(sub, 0.0) + v
    return total, funcs


def funcoes_dca(items: list[dict]) -> tuple[float, dict]:
    """Lê a DCA Anexo I-E (exceto intraorçamentárias), coluna Despesas Empenhadas."""
    funcs: dict[str, dict] = {}
    total = 0.0
    atual: str | None = None
    for i in items:
        if i["coluna"] != "Despesas Empenhadas":
            continue
        conta = i["conta"].strip()
        v = mi(i["valor"] or 0)
        if conta.startswith("Despesas Intra"):
            break  # daqui em diante só intraorçamentárias
        if conta.startswith("Despesas Exceto"):
            total = v
            continue
        m = re.match(r"^(\d{2}) - ", conta)
        ms = re.match(r"^(\d{2})\.\d{3} - (.*)", conta)
        mf = re.match(r"^FU(\d{2}) - (.*)", conta)
        if m and not ms:
            atual = FUNCOES.get(m.group(1), conta[5:])
            funcs.setdefault(atual, {"valor": 0.0, "subs": {}})["valor"] += v
        elif (ms or mf) and atual:
            nome = ms.group(2) if ms else _nome_sub(conta)
            subs = funcs[atual]["subs"]
            subs[nome] = subs.get(nome, 0.0) + v
    return total, funcs


def arvore_funcoes(prefixo: str, nome: str, total: float, funcs: dict, fonte: dict,
                   nota: str | None = None) -> Node:
    filhos = []
    for fn, d in funcs.items():
        fid = f"{prefixo}.{slug(fn)}"
        subs = podar(node(f"{fid}.{slug(s)}", s, v, "empenhado", fonte) for s, v in d["subs"].items())
        filhos.append(node(fid, fn, d["valor"], "empenhado", fonte, filhos=subs or None))
    return node(prefixo, nome, total, "empenhado", fonte, nota=nota, filhos=podar(filhos))


def achar(n: Node, id_: str) -> Node:
    if n["id"] == id_:
        return n
    for f in n.get("filhos", []):
        if id_.startswith(f["id"]):
            try:
                return achar(f, id_)
            except KeyError:
                pass
    raise KeyError(id_)


# ------------------------------------------------------------------ RTN

class RTN:
    def __init__(self) -> None:
        d = json.loads((RAW / "rtn" / "rtn_anual.json").read_text("utf-8"))
        self.fonte = d["fonte"]
        self.por_codigo: dict[str, dict[str, float]] = {}
        for rotulo, serie in d["linhas"].items():
            cod = rotulo.split()[0]
            self.por_codigo.setdefault(cod, serie)
        self.pct_pib = d["receita_total_pct_pib"]

    def v(self, cod: str, ano: int = 2025) -> float:
        return self.por_codigo[cod][str(ano)]

    def serie(self, cod: str) -> list[dict]:
        return [{"ano": int(a), "valor": round(v, 1)} for a, v in sorted(self.por_codigo[cod].items())]

    def pib(self) -> float:
        p = self.pct_pib["2025"]
        return self.v("1.") / (p if p < 1 else p / 100)

    def no(self, prefixo: str, cod: str, nome: str, filhos: list | None = None, base: str = "caixa", **kw) -> Node:
        return node(f"{prefixo}", nome, self.v(cod), base, self.fonte, serie=self.serie(cod),
                    filhos=podar(filhos) if filhos else None, **kw)


def uniao_receitas(rtn: RTN, rreo_a01: list[dict]) -> Node:
    P = "uniao.receitas"
    f_ipca = seed.RTN_IPCA

    def ipca(chave: str) -> dict:
        return {"valor_ipca_dez2025": indicador(seed.RTN_IPCA_BI[chave] * 1e3, "R$ mi", f_ipca,
                                                "Mesmo item a preços de dez/2025 (IPCA), como divulgado no RTN.")}

    def sub(pref: str, specs: list[tuple]) -> list[Node]:
        out = []
        for spec in specs:
            cod, nome, *resto = spec
            filhos = sub(f"{pref}.{slug(nome)}", resto[0]) if resto and isinstance(resto[0], list) else None
            kw = resto[1] if len(resto) > 1 else (resto[0] if resto and isinstance(resto[0], dict) else {})
            out.append(rtn.no(f"{pref}.{slug(nome)}", cod, nome, filhos, **kw))
        return out

    rfb = [
        ("1.1.01", "Imposto de Importação", {"indicadores": ipca("Imposto sobre a Importação")}),
        ("1.1.02", "IPI", [
            ("1.1.02.1", "IPI – fumo"), ("1.1.02.2", "IPI – bebidas"), ("1.1.02.3", "IPI – automóveis"),
            ("1.1.02.4", "IPI – vinculado à importação"), ("1.1.02.5", "IPI – outros"),
        ], {"indicadores": ipca("IPI")}),
        ("1.1.03", "Imposto de Renda", [
            ("1.1.03.1", "IR – pessoa física"), ("1.1.03.2", "IR – pessoa jurídica"),
            ("1.1.03.3", "IR – retido na fonte", [
                ("1.1.03.3.1", "IRRF – rendimentos do trabalho"), ("1.1.03.3.2", "IRRF – rendimentos do capital"),
                ("1.1.03.3.3", "IRRF – residentes no exterior"), ("1.1.03.3.4", "IRRF – outros rendimentos"),
            ]),
        ], {"indicadores": ipca("Imposto sobre a Renda")}),
        ("1.1.04", "IOF", {"indicadores": ipca("IOF")}),
        ("1.1.05", "Cofins", {"indicadores": ipca("Cofins")}),
        ("1.1.06", "PIS/Pasep", {"indicadores": ipca("PIS/Pasep")}),
        ("1.1.07", "CSLL", {"indicadores": ipca("CSLL")}),
        ("1.1.09", "CIDE – combustíveis", {"indicadores": ipca("CIDE - Combustíveis")}),
        ("1.1.10", "Outras receitas administradas pela RFB"),
    ]
    nao_adm = [
        ("1.4.1", "Concessões e permissões"),
        ("1.4.2", "Dividendos e participações", [
            ("1.4.2.1", "Banco do Brasil"), ("1.4.2.2", "BNB"), ("1.4.2.3", "BNDES"),
            ("1.4.2.4", "Caixa Econômica Federal"), ("1.4.2.6", "Eletrobras"), ("1.4.2.8", "Petrobras"),
            ("1.4.2.9", "Demais dividendos e participações"),
        ]),
        ("1.4.3", "Contribuição do servidor ao plano de seguridade (PSS)"),
        ("1.4.4", "Exploração de recursos naturais",
         {"nota": "Royalties e participações especiais de petróleo, gás e minérios."}),
        ("1.4.5", "Receitas próprias de órgãos e entidades"),
        ("1.4.6", "Salário-educação"),
        ("1.4.7", "Complemento para o FGTS (LC 110/2001)"),
        ("1.4.8", "Demais receitas não administradas"),
    ]
    filhos = [
        rtn.no(f"{P}.rfb", "1.1", "Receitas administradas pela Receita Federal", sub(f"{P}.rfb", rfb),
               indicadores=ipca("Receita administrada pela RFB"),
               nota="Impostos e contribuições arrecadados pela Receita Federal (exceto a contribuição ao RGPS)."),
        rtn.no(f"{P}.rgps", "1.3", "Arrecadação líquida para o RGPS", [
            rtn.no(f"{P}.rgps.urbana", "1.3.1", "RGPS – urbana"),
            rtn.no(f"{P}.rgps.rural", "1.3.2", "RGPS – rural"),
        ], indicadores=ipca("Arrecadação líquida para o RGPS"),
            nota="Contribuições de empregadores e trabalhadores ao INSS, líquidas de restituições."),
        rtn.no(f"{P}.nao_administradas", "1.4", "Receitas não administradas pela RFB",
               sub(f"{P}.nao_administradas", nao_adm), indicadores=ipca("Receitas não administradas pela RFB")),
    ]
    inc = rtn.v("1.2")
    if abs(inc) >= 0.05:
        filhos.append(rtn.no(f"{P}.incentivos", "1.2", "Incentivos fiscais"))

    a01 = {i["cod_conta"]: mi(i["valor"]) for i in rreo_a01 if i["coluna"] == "Até o Bimestre (c)"}
    f_a01 = fonte_siconfi("União", "RREO-Anexo 01", 1, "Balanço orçamentário – receitas realizadas")
    transf = [
        ("2.1", "FPM / FPE / IPI-Exportação"), ("2.2", "Fundos constitucionais"),
        ("2.3", "Salário-educação"), ("2.4", "Exploração de recursos naturais"),
        ("2.5", "CIDE – combustíveis"), ("2.6", "Demais transferências"),
    ]
    ind = {
        "transferencias_reparticao": indicador(rtn.v("2."), "R$ mi", rtn.fonte,
                                               "Parte da receita que a União repassa a estados e municípios (FPE, FPM etc.)."),
        **{f"transf_{slug(n)}": indicador(rtn.v(c), "R$ mi", rtn.fonte, f"Transferência por repartição: {n}")
           for c, n in transf},
        "receita_liquida": indicador(rtn.v("3."), "R$ mi", rtn.fonte, "Receita total menos transferências por repartição."),
        "despesa_primaria_total": indicador(rtn.v("4."), "R$ mi", rtn.fonte, "Despesa primária do Governo Central (valor pago)."),
        "resultado_primario": indicador(rtn.v("5."), "R$ mi", rtn.fonte, "Receita líquida menos despesa primária (acima da linha)."),
        "juros_nominais": indicador(rtn.v("9."), "R$ mi", rtn.fonte, "Juros nominais apurados pelo Banco Central (abaixo da linha)."),
        "resultado_nominal": indicador(rtn.v("10."), "R$ mi", rtn.fonte),
        "receita_total_ipca": indicador(seed.RTN_IPCA_BI["Receita total"] * 1e3, "R$ mi", f_ipca,
                                        "Receita total a preços de dez/2025 (IPCA)."),
        "receita_liquida_ipca": indicador(seed.RTN_IPCA_BI["Receita líquida"] * 1e3, "R$ mi", f_ipca,
                                          "Receita líquida a preços de dez/2025 (IPCA)."),
        "receitas_orcamentarias_rreo": indicador(a01["ReceitasExcetoIntraOrcamentarias"], "R$ mi", f_a01,
            "Conceito orçamentário (RREO): inclui operações de crédito "
            f"(R$ {a01['ReceitasDeOperacoesDeCredito'] / 1e3:,.1f} bi) e não inclui o refinanciamento da dívida "
            f"(R$ {a01['OperacoesDeCreditoRefinanciamento'] / 1e3:,.1f} bi).".replace(",", "X").replace(".", ",").replace("X", ".")),
    }
    return node(P, "Receitas da União", rtn.v("1."), "caixa", rtn.fonte, serie=rtn.serie("1."),
                nota=("Receita primária do Governo Central pelo conceito de caixa (RTN), em valores nominais. "
                      "Não inclui emissão de dívida. Os valores a preços de dez/2025 (IPCA) aparecem como indicadores."),
                indicadores=ind, filhos=filhos)


# ------------------------------------------------------------------ União – despesas

def anexo4_uniao() -> dict[str, float]:
    """Totais dos anexos 04.2 (RPPS civil e FCDF), 04.3 (militares) e 04.4 (RGPS), em R$ mi."""
    out: dict[str, float] = {}
    mapa = {
        "TOTAL DAS RECEITAS PREVIDENCIÁRIAS RPPS CIVIS": "rpps_receita",
        "TOTAL DAS DESPESAS PREVIDENCIÁRIAS RPPS CIVIS": "rpps_despesa",
        "TOTAL DAS RECEITAS PREVIDENCIÁRIAS DO FCDF": "fcdf_receita",
        "TOTAL DAS DESPESAS PREVIDENCIÁRIAS DO FCDF": "fcdf_despesa",
        "TOTAL DAS RECEITAS ASSOCIADAS ÀS PENSÕES MILITARES": "mil_pensoes_receita",
        "TOTAL DAS DESPESAS ASSOCIADAS ÀS PENSÕES MILITARES": "mil_pensoes_despesa",
        "TOTAL DESPESAS - MILITARES INATIVOS": "mil_inativos_despesa",
        "Total das Receitas Previdenciárias - RGPS": "rgps_receita",
        "Total das Despesas Previdenciárias - RGPS": "rgps_despesa",
    }
    for anexo in ["RREO-Anexo 04.2", "RREO-Anexo 04.3", "RREO-Anexo 04.4 - RGPS"]:
        for i in siconfi.rreo(anexo, 1, offline=True):
            col = i["coluna"].upper()
            if not (col.startswith("RECEITAS REALIZADAS ATÉ O BIMESTRE") or col.startswith("DESPESAS LIQUIDADAS ATÉ O BIMESTRE")):
                continue
            for rot, chave in mapa.items():
                if i["conta"].startswith(rot) and chave not in out:
                    out[chave] = mi(i["valor"])
    falt = set(mapa.values()) - set(out)
    assert not falt, f"Anexo 04 da União sem: {falt}"
    return out


def uniao_despesas(rtn: RTN, mps: dict) -> tuple[Node, dict]:
    P = "uniao.despesas"
    a02 = siconfi.rreo("RREO-Anexo 02", 1, offline=True)
    total, funcs = funcoes_rreo(a02, incluir_intra=True)
    _, liq = funcoes_rreo(a02, incluir_intra=True, coluna=COL_LIQUIDADO)
    f = fonte_siconfi("União", "RREO-Anexo 02", 1, "Despesas por função/subfunção – empenhado (I + II)")
    root = arvore_funcoes(P, "Despesas da União", total, funcs, f, nota=(
        "Despesa empenhada em 2025 por função e subfunção, incluindo as despesas intraorçamentárias, como no "
        "boletim do CONORF/Senado. Não inclui o refinanciamento (rolagem) da dívida."))
    f_conorf = seed.CONORF
    for fn in root["filhos"]:
        nome = fn["nome"]
        fn.setdefault("indicadores", {})
        if nome in liq:
            fn["indicadores"]["liquidado"] = indicador(liq[nome]["valor"], "R$ mi", f, "Despesa liquidada no ano (I + II).")
        if nome in seed.CONORF_FUNCOES_BI:
            fn["indicadores"]["valor_conorf"] = indicador(seed.CONORF_FUNCOES_BI[nome] * 1e3, "R$ mi", f_conorf,
                                                          "Valor publicado no boletim do CONORF (empenhado).")
    root["indicadores"] = {"valor_conorf": indicador(seed.CONORF_TOTAL_BI * 1e3, "R$ mi", f_conorf,
                                                     "Total publicado pelo CONORF (empenhado).")}

    def ach(sub: str) -> Node:
        return achar(root, f"{P}.{sub}")

    # Encargos Especiais
    ee = ach("encargos_especiais")
    ee["nota"] = ("Encargos Especiais não é um setor: reúne juros e amortização da dívida, transferências "
                  "constitucionais a estados e municípios, precatórios e ressarcimentos. A diferença em relação ao "
                  "CONORF (R$ 1.455,6 bi) está concentrada nesta função e não é explicada pelas fontes consultadas.")

    # Previdência
    a4 = anexo4_uniao()
    f42 = fonte_siconfi("União", "RREO-Anexo 04.2", 1, "RPPS dos servidores civis e FCDF")
    f43 = fonte_siconfi("União", "RREO-Anexo 04.3", 1, "Pensões e inativos militares")
    f44 = fonte_siconfi("União", "RREO-Anexo 04.4 - RGPS", 1, "RGPS")
    prev = ach("previdencia_social")
    mil_desp = a4["mil_pensoes_despesa"] + a4["mil_inativos_despesa"]
    prev["nota"] = ("Despesa empenhada da função Previdência Social. Os detalhes dos regimes (RGPS, RPPS, militares) "
                    "vêm de outras bases (caixa, liquidado) e não batem centavo por centavo com o empenhado. "
                    "Inativos e pensionistas militares ficam majoritariamente na função Defesa Nacional; o Tesouro só "
                    "considera previdenciárias as pensões militares.")
    prev["indicadores"].update({
        "rpps_civil_despesa": indicador(a4["rpps_despesa"], "R$ mi", f42, "RPPS dos servidores civis – despesa liquidada."),
        "rpps_civil_receita": indicador(a4["rpps_receita"], "R$ mi", f42, "RPPS dos servidores civis – receita."),
        "rpps_civil_deficit": indicador(a4["rpps_receita"] - a4["rpps_despesa"], "R$ mi", f42, "Resultado (receita − despesa)."),
        "militares_despesa": indicador(mil_desp, "R$ mi", f43, "Militares inativos e pensionistas – despesa liquidada."),
        "militares_receita": indicador(a4["mil_pensoes_receita"], "R$ mi", f43, "Contribuições associadas às pensões militares."),
        "militares_deficit": indicador(a4["mil_pensoes_receita"] - mil_desp, "R$ mi", f43, "Resultado (receita − despesa)."),
        "fcdf_despesa": indicador(a4["fcdf_despesa"], "R$ mi", f42, "Fundo Constitucional do DF – despesa previdenciária."),
        "fcdf_deficit": indicador(a4["fcdf_receita"] - a4["fcdf_despesa"], "R$ mi", f42, "FCDF – resultado (receita − despesa)."),
    })

    v = mps["valores_milhoes"]
    f_mps = mps["fonte"]
    f_beps = seed.BEPS
    rgps = ach("previdencia_social.previdencia_basica")
    rgps["nome"] = "Previdência Básica (RGPS/INSS)"
    rgps["nota"] = ("Subfunção orçamentária do RGPS (empenhado). Os itens abaixo vêm do resultado do RGPS do Ministério "
                    "da Previdência (regime de caixa). O passivo judicial (sentenças e precatórios de benefícios) não "
                    "está detalhado aqui.")
    rgps["indicadores"] = {
        "despesa_caixa": indicador(v["despesa"], "R$ mi", f_mps, "Despesa total do RGPS no regime de caixa (MPS)."),
        "passivo_judicial": indicador(v["passivo_judicial"], "R$ mi", f_mps,
                                      f"Sentenças judiciais e precatórios (urbano {v['passivo_urbano']/1e3:.1f} bi, rural {v['passivo_rural']/1e3:.1f} bi).".replace(".", ",")),
        "arrecadacao": indicador(v["arrecadacao"], "R$ mi", f_mps, "Arrecadação líquida do RGPS."),
        "deficit": indicador(v["resultado_urbano"] + v["resultado_rural"], "R$ mi", f_mps, "Resultado do RGPS (arrecadação − despesa)."),
        "despesa_liquidada_rreo": indicador(a4["rgps_despesa"], "R$ mi", f44, "Despesa previdenciária do RGPS no RREO (liquidado)."),
        "beneficios": indicador(seed.BEPS_TOTAL, "benefícios", f_beps, "Quantidade de benefícios ativos em dez/2025."),
        **{f"faixa_{slug(k)}": indicador(q, "benefícios", f_beps, f"Benefícios com valor: {k.lower()}")
           for k, q in seed.BEPS_FAIXAS.items()},
        "ate_1sm_pct_qtd": indicador(seed.BEPS_ATE_1SM_PCT_QTD, "%", f_beps, "Benefícios de até 1 salário mínimo: % da quantidade."),
        "ate_1sm_pct_despesa": indicador(seed.BEPS_ATE_1SM_PCT_DESPESA, "%", f_beps, "Benefícios de até 1 salário mínimo: % da despesa."),
    }
    rgps["filhos"] = [
        node(f"{rgps['id']}.urbano", "Benefícios urbanos", v["beneficios_urbanos"], "caixa", f_mps, indicadores={
            "arrecadacao": indicador(v["arrecadacao_urbana"], "R$ mi", f_mps, "Arrecadação líquida urbana."),
            "deficit": indicador(v["resultado_urbano"], "R$ mi", f_mps, "Resultado urbano (inclui Comprev e passivo judicial urbano)."),
            "passivo_judicial": indicador(v["passivo_urbano"], "R$ mi", f_mps),
            "beneficios": indicador(seed.BEPS_URBANO, "benefícios", f_beps),
        }),
        node(f"{rgps['id']}.rural", "Benefícios rurais", v["beneficios_rurais"], "caixa", f_mps, indicadores={
            "arrecadacao": indicador(v["arrecadacao_rural"], "R$ mi", f_mps, "Arrecadação líquida rural."),
            "deficit": indicador(v["resultado_rural"], "R$ mi", f_mps, "Resultado rural (inclui passivo judicial rural)."),
            "passivo_judicial": indicador(v["passivo_rural"], "R$ mi", f_mps),
            "beneficios": indicador(seed.BEPS_RURAL, "benefícios", f_beps),
        }, nota="A aposentadoria rural tem contribuição pequena por desenho constitucional; por isso o déficit é alto."),
        node(f"{rgps['id']}.comprev", "Compensação a regimes próprios (Comprev)", v["comprev"], "caixa", f_mps,
             nota="Valores que o INSS paga a RPPS de servidores pelo tempo de contribuição ao RGPS."),
    ]
    est = ach("previdencia_social.previdencia_do_regime_estatutario")
    est["nome"] = "Previdência do Regime Estatutário (RPPS civil)"
    est["indicadores"] = {k: prev["indicadores"][k] for k in ("rpps_civil_despesa", "rpps_civil_receita", "rpps_civil_deficit")}

    # Assistência
    asg = ach("assistencia_social")
    asg["indicadores"].update({
        "bolsa_familia": indicador(seed.CONORF_ASSISTENCIA_BI["Bolsa Família"] * 1e3, "R$ mi", f_conorf, "Bolsa Família (empenhado)."),
        "bpc_rmv": indicador(seed.CONORF_ASSISTENCIA_BI["BPC + RMV"] * 1e3, "R$ mi", f_conorf,
                             "Benefício de Prestação Continuada e Renda Mensal Vitalícia (empenhado)."),
        "bolsa_familia_pago": indicador(rtn.v("4.4.1.2"), "R$ mi", rtn.fonte, "Bolsa Família – valor pago (RTN)."),
        "bpc_rmv_pago": indicador(rtn.v("4.3.05"), "R$ mi", rtn.fonte, "BPC/LOAS e RMV – valor pago (RTN)."),
    })
    asg["nota"] = ("O Bolsa Família fica principalmente em \"Demais subfunções\"; o BPC, nas subfunções de assistência "
                   "ao idoso e à pessoa com deficiência.")

    trab = ach("trabalho")
    trab["nota"] = "A Justiça do Trabalho fica na função Judiciária, não em Trabalho."
    trab["indicadores"].update({
        "abono_seguro": indicador(rtn.v("4.3.01"), "R$ mi", rtn.fonte, "Abono salarial + seguro-desemprego – valor pago (RTN)."),
        "abono_seguro_ipca": indicador(seed.RTN_IPCA_BI["Abono e seguro-desemprego"] * 1e3, "R$ mi", seed.RTN_IPCA,
                                       "Abono + seguro-desemprego a preços de dez/2025 (IPCA)."),
    })
    defesa = ach("defesa_nacional")
    defesa["nota"] = "Inclui o pagamento de militares inativos e pensionistas (ver indicadores)."
    defesa["indicadores"].update({
        "militares_inativos": indicador(a4["mil_inativos_despesa"], "R$ mi", f43, "Militares inativos (reformas e reservas) – liquidado."),
        "pensoes_militares": indicador(a4["mil_pensoes_despesa"], "R$ mi", f43, "Pensões militares – liquidado."),
    })
    return fechar(root), a4


# ------------------------------------------------------------------ Estados

def anexo04_uf(items: list[dict]) -> dict[str, float]:
    cods = {
        "TotalReceitasRPPSFinanceiro": "rpps_fin_receita", "TotalDasDespesasRPPSFinanceiro": "rpps_fin_despesa",
        "TotalReceitasRPPSPrevidenciario": "rpps_prev_receita", "TotalDasDespesasRPPSPrevidenciario": "rpps_prev_despesa",
        "TotalDasContribucoesDosMilirares": "mil_receita",
        "TotalDasDespesasComInativosEPensionistasMilirares": "mil_despesa",
        "TotalDasReceitasBeneficiosMantidosPeloTesouro": "tesouro_receita",
        "TotalDasDespesasBeneficiosMantidosPeloTesouro": "tesouro_despesa",
    }
    out: dict[str, float] = {}
    for i in items:
        c = i["coluna"]
        if not (c.startswith("RECEITAS REALIZADAS ATÉ O BIMESTRE") or c.startswith("DESPESAS LIQUIDADAS ATÉ O BIMESTRE")):
            continue
        k = cods.get(i["cod_conta"])
        if k and k not in out:
            out[k] = mi(i["valor"] or 0)
    return out


A03_SPEC = [  # (código, nome, filhos)
    ("ReceitaTributariaLiquidaExcetoTransferenciasEFUNDEB", "Impostos, taxas e contribuições de melhoria", [
        ("ICMSLiquidoExcetoTransferenciasEFUNDEB", "ICMS"), ("IPVALiquidoExcetoTransferenciasEFUNDEB", "IPVA"),
        ("ITCDLiquidoExcetoTransferenciasEFUNDEB", "ITCD"), ("IRRFLiquidoExcetoTransferenciasEFUNDEB", "IRRF"),
        ("ISSLiquidoExcetoTransferenciasEFUNDEB", "ISS"), ("IPTULiquidoExcetoTransferenciasEFUNDEB", "IPTU"),
        ("ITBILiquidoExcetoTransferenciasEFUNDEB", "ITBI"),
        ("OutrasReceitasTributarias", "Outros impostos, taxas e contribuições de melhoria"),
    ]),
    ("RREO3ReceitaDeContribuicoes", "Contribuições", []),
    ("RREO3ReceitaPatrimonial", "Receita patrimonial", [
        ("RendimentosDeAplicacaoFinanceira", "Rendimentos de aplicação financeira"),
        ("OutrasReceitasPatrimoniais", "Outras receitas patrimoniais"),
    ]),
    ("RREO3ReceitaAgropecuaria", "Receita agropecuária", []),
    ("RREO3ReceitaIndustrial", "Receita industrial", []),
    ("RREO3ReceitaDeServicos", "Receita de serviços", []),
    ("RREO3TransferenciasCorrentes", "Transferências correntes", [
        ("RREO3CotaParteDoFPE", "Cota-parte do FPE"), ("RREO3CotaParteDoFPM", "Cota-parte do FPM"),
        ("RREO3CotaParteDoITR", "Cota-parte do ITR"), ("RREO3TransferenciasDaLC611989", "Transferências da LC 61/1989 (IPI-Exportação)"),
        ("RREO3TransferenciasDoFUNDEB", "Transferências do Fundeb"),
        ("RREO3OutrasTransferenciasCorrentes", "Outras transferências correntes"),
    ]),
    ("RREO3OutrasReceitasCorrentes", "Outras receitas correntes", []),
]
A01_CAPITAL = [
    ("ReceitasDeOperacoesDeCredito", "Operações de crédito"), ("AlienacaoDeBens", "Alienação de bens"),
    ("AmortizacoesDeEmprestimos", "Amortização de empréstimos"), ("TransferenciasDeCapital", "Transferências de capital"),
    ("OutrasReceitasDeCapital", "Outras receitas de capital"),
]


def receitas_uf(prefixo: str, nome_ente: str, cod: int, a01: list[dict], a03: list[dict]) -> Node:
    f3 = fonte_siconfi(nome_ente, "RREO-Anexo 03", cod, "Receita corrente líquida – total dos últimos 12 meses")
    f1 = fonte_siconfi(nome_ente, "RREO-Anexo 01", cod, "Balanço orçamentário – receitas realizadas")
    v3 = {}
    for i in a03:
        if i["coluna"] == "TOTAL (ÚLTIMOS 12 MESES)":
            v3.setdefault(i["cod_conta"], mi(i["valor"] or 0))
    v1 = {}
    for i in a01:
        if i["coluna"] == "Até o Bimestre (c)":
            v1.setdefault(i["cod_conta"], mi(i["valor"] or 0))
    corr_id = f"{prefixo}.correntes"
    corr = []
    for c, nome, subs in A03_SPEC:
        if c not in v3:
            continue
        nid = f"{corr_id}.{slug(nome)}"
        fil = podar(node(f"{nid}.{slug(n)}", n, v3[sc], "arrecadado", f3) for sc, n in subs if sc in v3)
        corr.append(node(nid, nome, v3[c], "arrecadado", f3, filhos=fil or None))
    correntes = node(corr_id, "Receitas correntes", v3["ReceitasCorrentesLiquidasExcetoTransferenciasEFUNDEB"],
                     "arrecadado", f3, filhos=podar(corr),
                     nota="Valores brutos, antes de repassar a cota-parte dos municípios e de formar o Fundeb (ver indicadores).")
    cap_id = f"{prefixo}.capital"
    capital = node(cap_id, "Receitas de capital", v1.get("ReceitasDeCapital", 0.0), "arrecadado", f1,
                   filhos=podar(node(f"{cap_id}.{slug(n)}", n, v1[c], "arrecadado", f1) for c, n in A01_CAPITAL if c in v1) or None)
    ind = {
        "transferencias_municipios": indicador(v3.get("ReceitaDeTransferenciasConstitucionaisELegais", 0.0), "R$ mi", f3,
                                               "Dedução: transferências constitucionais e legais aos municípios."),
        "deducao_fundeb": indicador(v3.get("DeducaoDeReceitaParaFormacaoDoFUNDEB", 0.0), "R$ mi", f3,
                                    "Dedução: parcela da receita destinada à formação do Fundeb."),
        "rcl": indicador(v3.get("RREO3ReceitaCorrenteLiquida", 0.0), "R$ mi", f3, "Receita corrente líquida (RCL)."),
        "receita_orcamentaria": indicador(v1.get("ReceitasExcetoIntraOrcamentarias", 0.0), "R$ mi", f1,
                                          "Receita orçamentária realizada (exceto intra), já líquida da dedução do Fundeb."),
    }
    return node(prefixo, f"Receitas – {nome_ente}", correntes["valor"] + capital["valor"], "arrecadado", [f3, f1],
                filhos=podar([correntes, capital]), indicadores=ind,
                nota="Receitas correntes dos últimos 12 meses (RREO Anexo 03) mais receitas de capital (Anexo 01), exceto intraorçamentárias.")


def despesas_uf(prefixo: str, nome_ente: str, cod: int, a02: list[dict], a04: list[dict]) -> Node:
    f = fonte_siconfi(nome_ente, "RREO-Anexo 02", cod, "Despesas por função/subfunção – empenhado (exceto intra)")
    total, funcs = funcoes_rreo(a02, incluir_intra=False)
    root = arvore_funcoes(prefixo, f"Despesas – {nome_ente}", total, funcs, f,
                          nota="Despesa empenhada em 2025 por função e subfunção, exceto intraorçamentárias (evita dupla contagem).")
    a4 = anexo04_uf(a04)
    f4 = fonte_siconfi(nome_ente, "RREO-Anexo 04", cod, "Demonstrativo das receitas e despesas previdenciárias")
    try:
        prev = achar(root, f"{prefixo}.previdencia_social")
    except KeyError:
        prev = None
    if prev is not None and a4:
        ind = prev.setdefault("indicadores", {})
        if "rpps_fin_despesa" in a4 or "rpps_prev_despesa" in a4:
            desp = a4.get("rpps_fin_despesa", 0) + a4.get("rpps_prev_despesa", 0)
            rec = a4.get("rpps_fin_receita", 0) + a4.get("rpps_prev_receita", 0)
            ind["rpps_despesa"] = indicador(desp, "R$ mi", f4, "RPPS (fundo em repartição + capitalizado) – despesa liquidada.")
            ind["rpps_receita"] = indicador(rec, "R$ mi", f4, "RPPS – receitas realizadas.")
            ind["rpps_resultado"] = indicador(rec - desp, "R$ mi", f4, "RPPS – resultado (receita − despesa).")
        if "mil_despesa" in a4:
            ind["militares_despesa"] = indicador(a4["mil_despesa"], "R$ mi", f4, "Inativos e pensionistas militares – despesa.")
            ind["militares_resultado"] = indicador(a4.get("mil_receita", 0) - a4["mil_despesa"], "R$ mi", f4,
                                                   "Militares – resultado (contribuições − despesa).")
        prev["nota"] = ("Inativos militares estaduais (policiais e bombeiros) podem estar fora da rubrica do RPPS; "
                        "veja os indicadores do Anexo 04.")
    return fechar(root), a4


def somar(arvores: list[Node], prefixo: str, nome: str, fonte: list[dict], nota: str) -> Node:
    """Soma árvores com a mesma estrutura relativa (ids depois do 1º segmento, ex.: "SP.despesas.saude").

    `prefixo` é o novo 1º segmento (ex.: "estados")."""
    def rel(id_: str) -> str:
        return id_.split(".", 1)[1] if "." in id_ else ""

    acc: dict[str, Node] = {}
    ordem: dict[str, list[str]] = {}

    def visita(n: Node, pai: str | None) -> None:
        r = rel(n["id"])
        if r not in acc:
            acc[r] = {"id": f"{prefixo}.{r}", "nome": n["nome"], "valor": 0.0, "base": n["base"],
                      "fonte": fonte, "_ind": {}}
            if n.get("estimado"):
                acc[r]["estimado"] = True
                acc[r]["nota"] = n.get("nota")
            if pai is not None:
                ordem.setdefault(pai, []).append(r)
        acc[r]["valor"] += n["valor"]
        for k, ind in n.get("indicadores", {}).items():
            if ind["unidade"] == "R$ mi":
                a = acc[r]["_ind"].setdefault(k, dict(ind, valor=0.0, fonte=fonte[0]))
                a["valor"] += ind["valor"]
        for f in n.get("filhos", []):
            visita(f, r)

    for a in arvores:
        visita(a, None)

    def monta(r: str) -> Node:
        n = acc[r]
        ind = n.pop("_ind")
        if ind:
            n["indicadores"] = {k: dict(v, valor=round(v["valor"], 1)) for k, v in ind.items()}
        if r in ordem:
            n["filhos"] = [monta(c) for c in ordem[r]]
        return n

    root = monta(rel(arvores[0]["id"]))
    root["nome"] = nome
    root["nota"] = nota
    return fechar(root)


# ------------------------------------------------------------------ Municípios

def municipios(pop: dict) -> tuple[Node, dict]:
    entes = siconfi.entes()
    muns = [e for e in entes if e["esfera"] == "M"]
    agg: dict[str, dict] = {}
    total = 0.0
    com_dados = 0
    pop_coberta = 0
    for e in muns:
        try:
            items = siconfi.rreo("DCA-Anexo I-E", e["cod_ibge"], offline=True)
        except FileNotFoundError:
            continue
        if not items:
            continue
        t, funcs = funcoes_dca(items)
        if t <= 0:
            continue
        com_dados += 1
        pop_coberta += pop["municipios"].get(str(e["cod_ibge"]), 0)
        total += t
        for fn, d in funcs.items():
            a = agg.setdefault(fn, {"valor": 0.0, "subs": {}})
            a["valor"] += d["valor"]
            for s, v in d["subs"].items():
                a["subs"][s] = a["subs"].get(s, 0.0) + v
    cobertura = {
        "entes_total": len(muns), "entes_com_dados": com_dados,
        "pct_entes": round(100 * com_dados / len(muns), 1),
        "pct_populacao": round(100 * pop_coberta / pop["brasil"], 1),
    }
    f = {"nome": "Siconfi/Tesouro – DCA 2025, Anexo I-E (despesa por função), todos os municípios",
         "url": "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca?an_exercicio=2025&no_anexo=DCA-Anexo%20I-E",
         "tabela": "Despesas empenhadas, exceto intraorçamentárias"}
    root = arvore_funcoes("municipios.despesas", "Despesas dos municípios (agregado)", total, agg, f, nota=(
        f"Soma das contas anuais (DCA 2025) de {com_dados:,} dos {len(muns):,} municípios "
        f"({cobertura['pct_entes']}% dos entes, {cobertura['pct_populacao']}% da população). "
        "Municípios que não enviaram a DCA ficam de fora; o total real é um pouco maior.").replace(",", "."))
    root["indicadores"] = {
        "deficit_atuarial_rpps": indicador(-seed.AEPS_DEFICIT_ATUARIAL_RPPS_MUN_BI * 1e3, "R$ mi", seed.AEPS,
                                           "Déficit ATUARIAL dos RPPS municipais (valor presente de compromissos futuros), "
                                           "não é gasto anual."),
        "entes_com_dados": indicador(com_dados, "municípios", f),
    }
    return fechar(root), cobertura


# ------------------------------------------------------------------ main

def main() -> None:
    rtn = RTN()
    mps = json.loads((RAW / "mps" / "rgps_2025.json").read_text("utf-8"))
    pop = json.loads((RAW / "ibge" / "populacao_2025.json").read_text("utf-8"))

    # União
    ud, a4u = uniao_despesas(rtn, mps)
    ur = fechar(uniao_receitas(rtn, siconfi.rreo("RREO-Anexo 01", 1, offline=True)))
    write(OUT / "uniao_despesas.json", ud)
    write(OUT / "uniao_receitas.json", ur)

    # Estados
    desp_ufs, rec_ufs, a4_ufs = [], [], {}
    for cod, (uf, nome) in UFS.items():
        a = {k: siconfi.rreo(f"RREO-Anexo {k}", cod, offline=True) for k in ("01", "02", "03", "04")}
        d, a4 = despesas_uf(f"{uf}.despesas", nome, cod, a["02"], a["04"])
        r = fechar(receitas_uf(f"{uf}.receitas", nome, cod, a["01"], a["03"]))
        desp_ufs.append(d)
        rec_ufs.append(r)
        a4_ufs[uf] = a4
        write(OUT / "estados" / f"{uf}.json", {"uf": uf, "nome": nome, "cod_ibge": cod, "despesas": d, "receitas": r})

    f_ufs = [{"nome": "Siconfi/Tesouro – RREO 2025, 6º bimestre, 26 estados e DF",
              "url": "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo?an_exercicio=2025&nr_periodo=6",
              "tabela": "Anexos 01, 02, 03 e 04"}]
    ed = somar(desp_ufs, "estados", "Despesas dos estados e DF (agregado)", f_ufs,
               "Soma do RREO das 27 UFs: despesa empenhada por função, exceto intraorçamentárias.")
    er = somar(rec_ufs, "estados", "Receitas dos estados e DF (agregado)", f_ufs,
               "Soma do RREO das 27 UFs. Receitas correntes brutas (antes da cota-parte dos municípios e do Fundeb) "
               "mais receitas de capital.")
    f_ifi = seed.IFI
    ed.setdefault("indicadores", {}).update({
        f"ifi_{slug(k)}": indicador(v * 1e3, "R$ mi", f_ifi, f"IFI – {k} (classificação econômica, conceito primário).")
        for k, v in seed.IFI_DESPESAS_BI.items()
    })
    ed["indicadores"]["previdencia_estadual_total"] = indicador(
        seed.IFI_PREVIDENCIA_ESTADUAL_BI * 1e3, "R$ mi", f_ifi,
        "Aposentadorias e pensões somando as rubricas de Pessoal e do RPPS (soma derivada dos dados da IFI).", estimado=True)
    er.setdefault("indicadores", {}).update({
        f"ifi_{slug(k)}": indicador(v * 1e3, "R$ mi", f_ifi, f"IFI – {k}. Conceito da IFI (primário, líquido de deduções); não é comparável diretamente com os valores brutos do RREO.")
        for k, v in seed.IFI_RECEITAS_BI.items()
    })
    write(OUT / "estados_despesas.json", ed)
    write(OUT / "estados_receitas.json", er)

    # Municípios
    md, cobertura = municipios(pop)
    write(OUT / "municipios_despesas.json", md)

    # Saldo (receita x despesa) onde o nó existe nos dois lados
    v = mps["valores_milhoes"]
    f_mps = mps["fonte"]
    f42 = fonte_siconfi("União", "RREO-Anexo 04.2", 1)
    f43 = fonte_siconfi("União", "RREO-Anexo 04.3", 1)
    pid = "uniao.despesas.previdencia_social"
    saldo_uniao = [
        {"id": "governo_central", "nome": "Governo Central – resultado primário", "receita": rtn.v("3."),
         "despesa": rtn.v("4."), "base": "caixa", "fonte": [rtn.fonte], "no": "uniao.receitas",
         "nota": "Receita líquida (após transferências a estados e municípios) menos despesa primária. Não inclui juros."},
        {"id": "rgps", "nome": "RGPS (INSS) – total", "receita": v["arrecadacao"], "despesa": v["despesa"],
         "base": "caixa", "fonte": [f_mps], "no": f"{pid}.previdencia_basica"},
        {"id": "rgps_urbano", "nome": "RGPS – urbano", "receita": v["arrecadacao_urbana"] + v["arrecadacao_comprev"],
         "despesa": v["beneficios_urbanos"] + v["passivo_urbano"] + v["comprev"], "base": "caixa", "fonte": [f_mps],
         "no": f"{pid}.previdencia_basica.urbano"},
        {"id": "rgps_rural", "nome": "RGPS – rural", "receita": v["arrecadacao_rural"],
         "despesa": v["beneficios_rurais"] + v["passivo_rural"], "base": "caixa", "fonte": [f_mps],
         "no": f"{pid}.previdencia_basica.rural"},
        {"id": "rpps_civil", "nome": "RPPS – servidores civis da União", "receita": a4u["rpps_receita"],
         "despesa": a4u["rpps_despesa"], "base": "liquidado", "fonte": [f42],
         "no": f"{pid}.previdencia_do_regime_estatutario"},
        {"id": "militares", "nome": "Militares inativos e pensionistas", "receita": a4u["mil_pensoes_receita"],
         "despesa": a4u["mil_pensoes_despesa"] + a4u["mil_inativos_despesa"], "base": "liquidado", "fonte": [f43],
         "no": "uniao.despesas.defesa_nacional",
         "nota": "O Tesouro só considera previdenciárias as pensões; os inativos não têm contribuição própria."},
        {"id": "fcdf", "nome": "FCDF – previdência (servidores do DF pagos pela União)", "receita": a4u["fcdf_receita"],
         "despesa": a4u["fcdf_despesa"], "base": "liquidado", "fonte": [f42]},
    ]

    def saldo_rpps(chave: str, nome: str, a4: dict, fonte: dict) -> list[dict]:
        out = []
        if "rpps_fin_despesa" in a4 or "rpps_prev_despesa" in a4:
            out.append({"id": "rpps", "nome": f"RPPS – {nome}",
                        "receita": a4.get("rpps_fin_receita", 0) + a4.get("rpps_prev_receita", 0),
                        "despesa": a4.get("rpps_fin_despesa", 0) + a4.get("rpps_prev_despesa", 0),
                        "base": "liquidado", "fonte": [fonte], "no": f"{chave}.despesas.previdencia_social"})
        if "mil_despesa" in a4:
            out.append({"id": "militares", "nome": f"Militares inativos e pensionistas – {nome}",
                        "receita": a4.get("mil_receita", 0), "despesa": a4["mil_despesa"],
                        "base": "liquidado", "fonte": [fonte], "no": f"{chave}.despesas.previdencia_social"})
        return out

    saldo: dict[str, list[dict]] = {"uniao": saldo_uniao}
    tot = {"rpps": [0.0, 0.0], "militares": [0.0, 0.0]}
    for cod, (uf, nome) in UFS.items():
        itens = saldo_rpps(uf, nome, a4_ufs[uf], fonte_siconfi(nome, "RREO-Anexo 04", cod))
        saldo[uf] = itens
        for it in itens:
            tot[it["id"]][0] += it["receita"]
            tot[it["id"]][1] += it["despesa"]
    saldo["estados"] = [
        {"id": "rpps", "nome": "RPPS – soma das 27 UFs", "receita": tot["rpps"][0], "despesa": tot["rpps"][1],
         "base": "liquidado", "fonte": f_ufs, "no": "estados.despesas.previdencia_social"},
        {"id": "militares", "nome": "Militares estaduais inativos e pensionistas – soma", "receita": tot["militares"][0],
         "despesa": tot["militares"][1], "base": "liquidado", "fonte": f_ufs,
         "no": "estados.despesas.previdencia_social",
         "nota": "Nem todas as UFs preenchem esta parte do Anexo 04."},
    ]
    for lst in saldo.values():
        for it in lst:
            it["receita"] = round(it["receita"], 1)
            it["despesa"] = round(it["despesa"], 1)
            it["saldo"] = round(it["receita"] - it["despesa"], 1)
    write(OUT / "saldo.json", saldo)

    # Comparar estados: valor de cada nó (id relativo, sem a UF) em cada UF
    comparar: dict[str, dict[str, dict[str, float]]] = {"despesas": {}, "receitas": {}}

    def coleta(n: Node, uf: str, destino: dict) -> None:
        rel = n["id"].split(".", 1)[1]
        destino.setdefault(rel, {})[uf] = n["valor"]
        for f in n.get("filhos", []):
            coleta(f, uf, destino)

    for d, r in zip(desp_ufs, rec_ufs):
        uf = d["id"].split(".")[0]
        coleta(d, uf, comparar["despesas"])
        coleta(r, uf, comparar["receitas"])
    write(OUT / "comparar.json", comparar)

    pib = rtn.pib()
    meta = {
        "atualizado_em": date.today().isoformat(),
        "exercicio": 2025,
        "pib": {"valor": round(pib, 1), "unidade": "R$ mi",
                "fonte": {"nome": "Tesouro Nacional – RTN (PIB implícito na Tabela 2.2-A, receita total em % do PIB)",
                          "url": rtn.fonte["url"]},
                "nota": "PIB nominal de 2025 usado pelo Tesouro, derivado da razão receita total / (% do PIB)."},
        "populacao": {"brasil": pop["brasil"], "uf": pop["uf"], "fonte": pop["fonte"]},
        "ufs": [{"sigla": uf, "nome": nome, "cod_ibge": cod} for cod, (uf, nome) in UFS.items()],
        "municipios": cobertura,
    }
    write(OUT / "meta.json", meta)
    print(f"União: despesas {ud['valor']/1e3:,.1f} bi; receitas {ur['valor']/1e3:,.1f} bi")
    print(f"Estados: despesas {ed['valor']/1e3:,.1f} bi; receitas {er['valor']/1e3:,.1f} bi")
    print(f"Municípios: despesas {md['valor']/1e3:,.1f} bi; cobertura {cobertura}")
    print(f"PIB 2025: {pib:,.0f} mi")


if __name__ == "__main__":
    main()
