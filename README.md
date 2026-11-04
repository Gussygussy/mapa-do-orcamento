# Orçamento Brasil 2025

**Site:** https://gussygussy.github.io/mapa-do-orcamento/

Explorador em árvore das despesas e receitas públicas do Brasil em 2025: União, 26 estados e DF,
e municípios (agregado). Cada item pode ser aberto em subitens, por exemplo
Despesas → Previdência Social → RGPS → Benefícios rurais. Todos os valores têm fonte e base
(empenhado, liquidado, pago, caixa ou arrecadado).

## Rodar

```bash
npm install
npm run dev
```

O app só lê arquivos estáticos de `public/data/`; não chama APIs externas no navegador.

## Atualizar os dados

```bash
pip install -r scripts/requirements.txt   # também precisa de pdftotext (poppler-utils)
python scripts/fetch_siconfi.py tudo
python scripts/fetch_rtn.py
python scripts/fetch_mps.py
python scripts/fetch_ibge.py
python scripts/fetch_transparencia.py
python scripts/build_tree.py
python scripts/validate.py
```

## Fontes

- Siconfi/Tesouro Nacional: RREO 2025 (União e UFs) e DCA 2025 (municípios)
- Tesouro Nacional: Resultado do Tesouro Nacional (RTN), série histórica
- Ministério da Previdência Social: resultado do RGPS dez/2025, urbano e rural
- IBGE: estimativas de população de 2025 e malha das UFs
- CONORF e IFI (Senado Federal), BEPS: valores de referência e indicadores

Regras do projeto, decisões e pendências estão em [`CLAUDE.md`](CLAUDE.md).
