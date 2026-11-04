# CLAUDE.md — Orçamento Brasil 2025 (explorador em árvore)

## Visão do produto

App web interativo para explorar **todas as despesas e receitas públicas do Brasil em 2025**:
União, 26 estados e DF e, quando houver dados, os municípios agregados. A navegação é
em **árvore**. Cada nó pode ser clicado para se dividir em subnós, por exemplo
Despesas → Previdência → RGPS → Rural. Ao lado da árvore, um **painel de detalhes**
mostra tabelas, gráficos e indicadores do nó selecionado.

Público: cidadão curioso, jornalista, estudante. A interface tem de ser intuitiva sem
manual e todo o texto fica em **português do Brasil**.

## Regras inegociáveis (ler antes de qualquer tarefa)

1. **Nenhum número inventado.** Cada valor exibido precisa de `fonte` (URL + nome do
   documento) e de `base` (empenhado, liquidado, pago, caixa ou arrecadado). Se um dado
   não foi encontrado, mostre "dado não disponível" em vez de estimar em silêncio.
2. **Estimativas ficam marcadas.** Qualquer valor calculado ou estimado leva
   `estimado: true` e um selo visual "estimativa", com a explicação do cálculo.
3. **Bases diferentes não se misturam sem aviso.** A função orçamentária (empenhado,
   SIOP/Siga Brasil) não bate centavo por centavo com o regime de caixa (Tesouro/MPS).
   Quando pai e filhos vierem de bases diferentes, o painel mostra um aviso.
4. **Filhos somam ao pai.** Se a soma dos filhos for menor que o pai, crie um nó
   `"Outros / não detalhado"` com a diferença. Se a soma passar do pai em mais de 1%,
   o script de validação deve falhar.
5. **Valores em R$ nominais correntes de 2025**, salvo indicação. Se a fonte só der
   valores a preços de dez/2025 (IPCA), registre `precos: "dez/2025 IPCA"`.
6. **Sem chamadas a APIs externas em tempo de execução no navegador** (CORS e
   instabilidade). Todos os dados são baixados e processados por scripts e salvos como
   JSON estático em `public/data/`.

## Stack

- **Vite + React + TypeScript** (modo strict)
- **Tailwind CSS** para estilos; suportar tema claro e escuro (`prefers-color-scheme` + botão)
- **ECharts** (`echarts-for-react`) para treemap, sunburst, barras, linhas e mapa do Brasil
- **TanStack Table** para tabelas ordenáveis e filtráveis
- **Zustand** para o estado global (nó selecionado, esfera, unidade, modo)
- **Vitest** + Testing Library para testes
- Scripts de dados em **Python 3** (`requests`, `pandas`, `openpyxl`) dentro de `scripts/`

## Estrutura de pastas

```
/
├── CLAUDE.md
├── scripts/                 # pipeline de dados (Python)
│   ├── fetch_*.py           # baixa dados brutos para data_raw/
│   ├── build_tree.py        # monta as árvores JSON finais
│   └── validate.py          # checa somas, fontes e campos obrigatórios
├── data_raw/                # cache dos downloads (no .gitignore)
├── public/data/
│   ├── uniao_despesas.json
│   ├── uniao_receitas.json
│   ├── estados_despesas.json
│   ├── estados_receitas.json
│   ├── estados/<UF>.json    # árvore por estado
│   └── meta.json            # PIB, população, data de atualização
└── src/
    ├── components/          # TreeNav, Breadcrumb, DetailPanel, charts/, tables/
    ├── store/
    ├── lib/format.ts        # formatação pt-BR (R$, bi, %, per capita)
    ├── lib/tree.ts          # utilitários de árvore (busca, caminho, soma)
    └── types.ts
```

## Modelo de dados

```ts
type Base = "empenhado" | "liquidado" | "pago" | "caixa" | "arrecadado";

interface Fonte {
  nome: string;            // ex.: "Boletim CONORF fev/2026 – Senado"
  url: string;
  tabela?: string;         // ex.: "Tabela 10 – Execução por função"
}

interface Node {
  id: string;              // caminho estável: "uniao.despesas.previdencia.rgps.rural"
  nome: string;
  valor: number;           // em R$ milhões
  base: Base;
  precos?: string;         // "nominal" (padrão) ou "dez/2025 IPCA"
  estimado?: boolean;
  nota?: string;           // explicação curta exibida no painel
  fonte: Fonte[];
  indicadores?: Record<string, { valor: number; unidade: string; fonte: Fonte }>;
  // ex.: beneficiarios, deficit, receita_propria, var_real_2024
  serie?: { ano: number; valor: number }[];   // histórico, se houver
  filhos?: Node[];
}
```

## Interface

**Layout desktop (3 colunas):**

1. **Esquerda — árvore navegável.** Nós recolhíveis com valor e % do pai ao lado de
   cada nome. Inclui busca por nome com destaque do caminho.
2. **Centro — visualização.** Treemap com drill-down ao clicar e breadcrumb no topo.
   Alternar para sunburst ou barras horizontais. Clicar num bloco seleciona o nó e
   desce um nível.
3. **Direita — painel de detalhes** do nó selecionado:
   - cartões de indicadores: valor, % do total, % do PIB, R$ per capita, variação real ante 2024 (se houver)
   - gráfico de composição dos filhos (barras ordenadas)
   - tabela dos filhos (nome, valor, % do pai, base, fonte)
   - indicadores extras do nó (ex.: nº de benefícios, déficit, receita própria)
   - bloco "Fontes e notas" com links e avisos de base ou estimativa

**Layout mobile:** a árvore vira gaveta lateral, a visualização fica no topo e o painel abaixo.

**Controles globais (barra superior):**
- Modo: **Despesas | Receitas | Saldo** (Saldo compara receita e despesa quando o nó existe nos dois lados, ex.: RGPS)
- Esfera: **União | Estados (agregado) | Estado específico | Comparar estados**
- Unidade: **R$ | % do total | % do PIB | per capita**
- "Comparar estados": mapa coroplético do Brasil + ranking, com a métrica do nó selecionado

**Requisitos de UX:**
- Valores grandes formatados como "R$ 1,10 tri", "R$ 240,2 bi", "R$ 850 mi" (`Intl.NumberFormat('pt-BR')`)
- Tooltips em todos os gráficos, com valor, % e fonte
- URL reflete o nó selecionado (`?no=uniao.despesas.previdencia`) para compartilhar
- Navegação por teclado na árvore (setas, Enter) e `aria-*` corretos
- Glossário embutido: ícone "?" ao lado de termos como empenhado, função, RGPS, RPPS, Encargos Especiais

## Fontes de dados (pipeline)

Confirme cada URL e endpoint antes de usar. As URLs podem ter mudado; se uma falhar,
procure a versão atual e registre a mudança aqui.

**União**
- Despesa por função e subfunção (empenhado): Siga Brasil (Senado) e Painel do Orçamento (SIOP) — https://www12.senado.leg.br/orcamento/sigabrasil
- Portal da Transparência (API, exige chave gratuita): https://api.portaldatransparencia.gov.br
- Resultado do Tesouro Nacional (RTN) dez/2025, receitas e despesas primárias: Tesouro Transparente
- Resultado do RGPS urbano e rural dez/2025 (MPS): https://www.gov.br/previdencia/pt-br/assuntos/previdencia-social/resultados-do-rgps/2025/resultado-do-rgps-2025-12-urbano-rural.pdf
- RREO da União, Anexo 4 (RGPS, RPPS, militares, FCDF): Tesouro Transparente, "RREO em Foco"
- Boletim Estatístico da Previdência Social (BEPS): benefícios por faixa de valor e espécie

**Estados e municípios**
- API do Siconfi (RREO e RGF por ente): `https://apidatalake.tesouro.gov.br/ords/siconfi/tt/` — endpoints `rreo`, `rgf`, `entes`
  - RREO Anexo 01 (receitas), Anexo 02 (despesa por função), Anexo 04 (previdência), Anexo 06 (resultado primário)
  - Exercício 2025, 6º bimestre; `id_ente` = código IBGE
- Boletim de Finanças dos Entes Subnacionais 2025 (Tesouro) e anexos em XLSX
- IFI/Senado, RAF nº 109 (fev/2026), Tabelas 3, 5 e 6 (estados 2025)

**Referência para % do PIB e per capita**
- PIB nominal 2025: R$ 12.733.576 milhões (Tesouro, RTN dez/2025). Atualizar se o IBGE revisar.
  → Revisado: o RTN de jul/2026 implica R$ 12.738.566 milhões (Tabela 2.2-A). O app usa o valor
  derivado pelo pipeline (`meta.json`); `validate.py` confere com o número acima (tolerância 0,1%).
- População 2025 por UF: estimativas do IBGE. Baixar via script, não fixar à mão.

**Mudanças de fonte registradas (nov/2026)**
- API `servicodados.ibge.gov.br` não respondeu a partir do ambiente de build. População e malha das
  UFs vêm do FTP do IBGE (`ftp.ibge.gov.br/Estimativas_de_Populacao/Estimativas_2025/estimativa_dou_2025.xls`
  e `geoftp.ibge.gov.br/.../municipio_2025/Brasil/BR_UF_2025.zip`). Ver `scripts/fetch_ibge.py`.
- RTN: a planilha "Série Histórica" muda de nome todo mês; `scripts/fetch_rtn.py` descobre a URL pela
  API CKAN do Tesouro Transparente (`package_show?id=resultado-do-tesouro-nacional`).
- RREO da União: o Anexo 04 é publicado como `RREO-Anexo 04.2` (RPPS civil e FCDF), `04.3` (militares)
  e `04.4 - RGPS`; `RREO-Anexo 04` vem vazio para a União.
- Estados: receitas por tributo (ICMS, IPVA, ITCD, IRRF, FPE, Fundeb) vêm do RREO **Anexo 03**
  (últimos 12 meses), pois o Anexo 01 só traz "Impostos".
- Municípios: cerca de 1/3 não tem o RREO do 6º bimestre na API. O agregado usa a **DCA 2025,
  Anexo I-E** (despesa por função/subfunção, empenhado), que cobre 5.506 de 5.570 municípios
  (97,8% da população).
- Resultado do RGPS: `scripts/fetch_mps.py` lê o PDF do MPS com `pdftotext` (poppler-utils).
- Portal da Transparência e Siga Brasil não foram usados (exigem chave ou não têm API estável);
  o detalhamento por programa/ação continua pendente.

## Dados de referência já levantados (seed e checagem)

Use estes números para montar a primeira versão e como **testes de sanidade** do pipeline.
Se o pipeline der algo muito diferente, investigue antes de seguir.

### União — Despesa por função, 2025 (R$ bi, empenhado)
Fonte: Boletim CONORF fev/2026, Senado, item 10.

Encargos Especiais 1.455,6 · Previdência Social 1.104,1 · Assistência Social 290,7 ·
Saúde 240,2 · Educação 189,5 · Trabalho 121,5 · Defesa Nacional 99,3 · Judiciária 51,8 ·
Agricultura 47,9 · Ciência e Tecnologia 35,4 · Administração 34,3 · Gestão Ambiental 32,4 ·
Segurança Pública 18,1 · Transporte 17,5 · Essencial à Justiça 10,7 · Legislativa 10,6 ·
Urbanismo 9,0 · Organização Agrária 5,1 · Comércio e Serviços 4,9 · Relações Exteriores 4,8 ·
Comunicações 3,1 · Cultura 2,9 · Indústria 2,5 · Desporto e Lazer 2,5 · Direitos da Cidadania 2,4 ·
Energia 1,3 · Saneamento 0,8 · Habitação 0,8 · **Total 3.799,7**

Nota obrigatória em Encargos Especiais: inclui juros e amortização da dívida, transferências
constitucionais a estados e municípios, precatórios e ressarcimentos. Não é um "setor".
O pipeline deve abrir esse nó por subfunção.

### Previdência — subdivisão
- **RGPS/INSS (caixa, MPS):** despesa total 1.026,9
  - Benefícios urbanos 768,3 · Benefícios rurais 209,7
  - Passivo judicial 42,3 (urbano 33,2 · rural 9,1) · Comprev 6,6
  - Indicadores: arrecadação líquida 709,7 (urbana 696,3 · rural 13,2); déficit 317,2 (urbano 111,6 · rural 205,6)
- **Servidores federais (RREO Anexo 4, 2025):**
  - RPPS civil: despesa 105,1 · receita 42,5 · déficit 62,6
  - Militares inativos e pensionistas: despesa 62,6 · receita 9,6 · déficit 53,0 (o Tesouro só considera previdenciárias as pensões)
  - FCDF: despesa 5,1 · receita 1,1 · déficit 4,0
- O total da função (1.104,1, empenhado) e a soma dos regimes vêm de bases diferentes. Mostre o aviso.
- Benefícios do RGPS por faixa (dez/2025): < 1 SM 968.457 · 1 SM 21.974.574 · 1–2 SM 6.646.354 ·
  2–3 SM 3.143.815 · > 3 SM 2.439.871 · total 35.173.071 (urbano 24.712.608 · rural 10.460.463).
  Benefícios até 1 SM são 65% da quantidade e 46% da despesa.

### Assistência Social
Bolsa Família 159,1 · BPC + RMV 121,7 · restante ≈ 9,9 (detalhar via subfunção/ação no pipeline)

### Trabalho
Abono salarial + seguro-desemprego ≈ 89,1 (RTN, preços dez/2025). O restante deve ser detalhado por ação.
Lembrete na UI: a Justiça do Trabalho fica em **Judiciária**, não em Trabalho.

### União — Receitas 2025 (RTN, R$ bi, preços dez/2025 IPCA)
Receita total 2.943,6 (nominal: 2.902,3) · Transferências por repartição −577,7 · Receita líquida 2.366,0 (nominal: 2.332,6)
- Administradas pela RFB 1.887,2: IR 880,5 · COFINS 396,9 · CSLL 180,9 · PIS/PASEP 107,4 ·
  II 91,7 · IPI 89,6 · IOF 87,5 · CIDE 3,4 · Outras 49,5
- Arrecadação líquida do RGPS 719,1
- Não administradas pela RFB 337,3: Exploração de recursos naturais 141,4 · Dividendos 50,4 ·
  Salário-educação 36,5 · Receitas próprias 24,6 · PSS do servidor 19,2 · Concessões 7,3 · Demais 57,8

### Estados + DF agregados, 2025 (IFI, RAF 109, R$ bi correntes)
**Receitas primárias 1.456,0:** ICMS 514,8 · IPVA 45,2 · ITCD 16,1 · IRRF 90,6 · Outras tributárias 57,2 ·
Contribuições 31,0 · Patrimoniais 44,3 · Transferências 369,0 (FPE/FPM 163,2 · Fundeb 118,8 · Demais 87,0) ·
Demais correntes 75,8 · Capital 18,5 · Receitas do RPPS 111,9

**Despesas primárias 1.455,6:** Pessoal 677,2 (ativos 504,9 · aposentados 133,0 · pensões 25,3 · precatórios 14,1) ·
Outras correntes 540,9 · Investimentos 110,2 · Inversões 19,6 · RPPS 107,7 (aposentados 87,7 · pensões 22,4 · ativos 3,0 · demais −5,5)

Previdência estadual total (aposentadorias + pensões, as duas fontes): ≈ 268,4 → marcar `estimado: true` (soma derivada).
Inativos militares estaduais podem estar fora da rubrica do RPPS. Mostrar nota.

### Municípios
Não há total anual consolidado na pesquisa inicial. O pipeline deve agregar RREO Anexo 02 e
Anexo 04 dos municípios via Siconfi e registrar a cobertura (quantos entes enviaram).
Indicador conhecido: déficit atuarial dos RPPS municipais ≈ R$ 295,4 bi (AEPS 2024, citado em estudo da Câmara).
É um valor atuarial, não um gasto anual. Rotular como tal.

## Fases de desenvolvimento

1. **Esqueleto:** Vite + React + TS + Tailwind, layout de 3 colunas, store, tipos
2. **Seed:** montar `uniao_despesas.json`, `uniao_receitas.json` e `estados_*.json` à mão
   a partir da seção acima, com fontes. A UI já deve funcionar com eles.
3. **Árvore + treemap + painel** funcionando com drill-down, breadcrumb e URL compartilhável
4. **Pipeline União:** scripts que baixam por função, subfunção e programa e substituem o seed
5. **Pipeline Estados:** Siconfi para as 27 UFs, gerando `estados/<UF>.json` e o agregado; mapa e ranking
6. **Municípios agregados** (se a cobertura for aceitável) com aviso de cobertura
7. **Polimento:** glossário, modo escuro, acessibilidade, testes, exportar CSV do nó atual

Ao terminar cada fase, rode testes e validação e peça revisão ao usuário antes de seguir.

## Comandos

```bash
npm install
npm run dev            # servidor local
npm run build
npm run test           # vitest
pip install -r scripts/requirements.txt          # + poppler-utils (pdftotext)
python scripts/fetch_siconfi.py tudo             # ~30 min (municípios); usa cache em data_raw/
python scripts/fetch_rtn.py && python scripts/fetch_mps.py && python scripts/fetch_ibge.py
python scripts/build_tree.py && python scripts/validate.py
```

## Estado atual (nov/2026)

Fases 1 a 7 implementadas. Pendências conhecidas:
- Encargos Especiais da União: RREO dá R$ 1.590,0 bi (com intra) e o CONORF R$ 1.455,6 bi; a
  diferença (R$ 134 bi) não foi explicada pelas fontes. `validate.py` registra como aviso e a UI mostra nota.
- Receitas municipais não foram agregadas (só despesas, via DCA).
- Detalhamento por programa/ação (Bolsa Família, BPC etc.) aparece só como indicador do nó.
- PIB por UF não está no pipeline, então "Comparar estados" não oferece % do PIB.

## Checagens antes de dizer "pronto"

- `validate.py` passa: todo nó tem `fonte` e `base`, e as somas fecham (tolerância de 1%)
- Os números de referência acima aparecem iguais (ou com diferença explicada) na UI
- Nenhum `localStorage` obrigatório; o app abre só com arquivos estáticos
- Lighthouse de acessibilidade ≥ 90; navegação por teclado funciona na árvore
- Nada de texto em inglês na interface

## Estilo de código

- Componentes funcionais pequenos; lógica de árvore em `lib/tree.ts`, com testes
- Nomes de variáveis em inglês e textos da UI em português
- Não adicionar dependências sem necessidade clara; justificar no commit
