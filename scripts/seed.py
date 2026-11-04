"""Dados de referência levantados à mão (CLAUDE.md, "Dados de referência já levantados").

Servem para dois fins:
1. Indicadores que nenhum pipeline automático cobre ainda (BEPS, IFI, AEPS, programas do CONORF).
2. Testes de sanidade em validate.py (os valores do pipeline têm de bater com estes).

Todos os valores estão em R$ milhões, salvo indicação.
"""
from __future__ import annotations

CONORF = {
    "nome": "Boletim CONORF fev/2026 – Consultoria de Orçamentos do Senado Federal",
    "url": "https://www12.senado.leg.br/orcamento",
    "tabela": "Item 10 – Execução da despesa por função (empenhado)",
}
IFI = {
    "nome": "IFI/Senado – Relatório de Acompanhamento Fiscal nº 109 (fev/2026)",
    "url": "https://www12.senado.leg.br/ifi/relatorio-de-acompanhamento-fiscal",
    "tabela": "Tabelas 3, 5 e 6 – Estados 2025",
}
BEPS = {
    "nome": "Boletim Estatístico da Previdência Social (BEPS) – dez/2025",
    "url": "https://www.gov.br/previdencia/pt-br/assuntos/previdencia-social/dados-estatisticos-previdencia-social-e-inss",
    "tabela": "Benefícios ativos por faixa de valor e clientela",
}
AEPS = {
    "nome": "AEPS 2024, citado em estudo da Consultoria Legislativa da Câmara dos Deputados",
    "url": "https://www.gov.br/previdencia/pt-br/assuntos/previdencia-social/dados-estatisticos-previdencia-social-e-inss",
}
RTN_IPCA = {
    "nome": "Tesouro Nacional – RTN dez/2025 (valores a preços de dez/2025, IPCA)",
    "url": "https://www.tesourotransparente.gov.br/ckan/dataset/resultado-do-tesouro-nacional",
}

# PIB nominal 2025 (Tesouro, RTN dez/2025). validate.py confere com a Tabela 2.2-A do RTN.
PIB_2025 = 12_733_576.0

# Despesa da União por função, 2025, empenhado (R$ bi) – usada como checagem do RREO.
CONORF_FUNCOES_BI = {
    "Encargos Especiais": 1455.6, "Previdência Social": 1104.1, "Assistência Social": 290.7,
    "Saúde": 240.2, "Educação": 189.5, "Trabalho": 121.5, "Defesa Nacional": 99.3, "Judiciária": 51.8,
    "Agricultura": 47.9, "Ciência e Tecnologia": 35.4, "Administração": 34.3, "Gestão Ambiental": 32.4,
    "Segurança Pública": 18.1, "Transporte": 17.5, "Essencial à Justiça": 10.7, "Legislativa": 10.6,
    "Urbanismo": 9.0, "Organização Agrária": 5.1, "Comércio e Serviços": 4.9, "Relações Exteriores": 4.8,
    "Comunicações": 3.1, "Cultura": 2.9, "Indústria": 2.5, "Desporto e Lazer": 2.5,
    "Direitos da Cidadania": 2.4, "Energia": 1.3, "Saneamento": 0.8, "Habitação": 0.8,
}
CONORF_TOTAL_BI = 3799.7

# Programas citados no CONORF (empenhado, R$ bi)
CONORF_ASSISTENCIA_BI = {"Bolsa Família": 159.1, "BPC + RMV": 121.7}

# RGPS – benefícios por faixa de valor, dez/2025 (quantidade)
BEPS_FAIXAS = {
    "Menos de 1 salário mínimo": 968_457,
    "1 salário mínimo": 21_974_574,
    "Mais de 1 a 2 SM": 6_646_354,
    "Mais de 2 a 3 SM": 3_143_815,
    "Mais de 3 SM": 2_439_871,
}
BEPS_TOTAL = 35_173_071
BEPS_URBANO = 24_712_608
BEPS_RURAL = 10_460_463
BEPS_ATE_1SM_PCT_QTD = 65.0
BEPS_ATE_1SM_PCT_DESPESA = 46.0

# Receitas da União 2025, RTN a preços de dez/2025 (IPCA), R$ bi – só referência/indicador.
RTN_IPCA_BI = {
    "Receita total": 2943.6, "Receita líquida": 2366.0, "Transferências por repartição": 577.7,
    "Receita administrada pela RFB": 1887.2, "Imposto sobre a Renda": 880.5, "Cofins": 396.9,
    "CSLL": 180.9, "PIS/Pasep": 107.4, "Imposto sobre a Importação": 91.7, "IPI": 89.6, "IOF": 87.5,
    "CIDE - Combustíveis": 3.4, "Arrecadação líquida para o RGPS": 719.1,
    "Receitas não administradas pela RFB": 337.3, "Abono e seguro-desemprego": 89.1,
}

# Estados + DF agregados, 2025 (IFI RAF 109, R$ bi correntes)
IFI_RECEITAS_BI = {
    "Receitas primárias": 1456.0, "ICMS": 514.8, "IPVA": 45.2, "ITCD": 16.1, "IRRF": 90.6,
    "Outras tributárias": 57.2, "Contribuições": 31.0, "Patrimoniais": 44.3, "Transferências": 369.0,
    "FPE/FPM": 163.2, "Fundeb": 118.8, "Demais transferências": 87.0, "Demais correntes": 75.8,
    "Capital": 18.5, "Receitas do RPPS": 111.9,
}
IFI_DESPESAS_BI = {
    "Despesas primárias": 1455.6, "Pessoal": 677.2, "Pessoal – ativos": 504.9,
    "Pessoal – aposentados": 133.0, "Pessoal – pensões": 25.3, "Pessoal – precatórios": 14.1,
    "Outras correntes": 540.9, "Investimentos": 110.2, "Inversões": 19.6, "RPPS": 107.7,
    "RPPS – aposentados": 87.7, "RPPS – pensões": 22.4, "RPPS – ativos": 3.0, "RPPS – demais": -5.5,
}
# Soma derivada (aposentados + pensões nas duas rubricas): estimativa
IFI_PREVIDENCIA_ESTADUAL_BI = 133.0 + 25.3 + 87.7 + 22.4  # = 268.4

# Municípios: déficit atuarial dos RPPS municipais (valor atuarial, não gasto anual)
AEPS_DEFICIT_ATUARIAL_RPPS_MUN_BI = 295.4
