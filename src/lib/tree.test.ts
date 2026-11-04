import type { Node } from "../types";
import { findNode, hasMixedBases, parentOf, pathTo, relId, searchTree, sumChildren, toCSV, visibleNodes, withPrefix } from "./tree";

const f = [{ nome: "Teste", url: "https://exemplo.gov.br" }];
const arvore: Node = {
  id: "uniao.despesas",
  nome: "Despesas",
  valor: 100,
  base: "empenhado",
  fonte: f,
  filhos: [
    {
      id: "uniao.despesas.previdencia",
      nome: "Previdência",
      valor: 60,
      base: "empenhado",
      fonte: f,
      filhos: [
        { id: "uniao.despesas.previdencia.rgps", nome: "RGPS rural", valor: 50, base: "caixa", fonte: f },
        { id: "uniao.despesas.previdencia.outros", nome: "Outros / não detalhado", valor: 10, base: "empenhado", fonte: f, estimado: true },
      ],
    },
    { id: "uniao.despesas.saude", nome: "Saúde", valor: 40, base: "empenhado", fonte: f },
  ],
};

describe("tree", () => {
  it("encontra nós e caminhos pelo id", () => {
    expect(findNode(arvore, "uniao.despesas.previdencia.rgps")?.nome).toBe("RGPS rural");
    expect(findNode(arvore, "uniao.despesas.nao_existe")).toBeUndefined();
    expect(pathTo(arvore, "uniao.despesas.previdencia.rgps").map((n) => n.nome)).toEqual(["Despesas", "Previdência", "RGPS rural"]);
    expect(parentOf(arvore, "uniao.despesas.saude")?.id).toBe("uniao.despesas");
  });
  it("não confunde ids com mesmo prefixo de texto", () => {
    const a: Node = { ...arvore, filhos: [{ ...arvore.filhos![1]!, id: "uniao.despesas.saude_x" }, arvore.filhos![1]!] };
    expect(findNode(a, "uniao.despesas.saude")?.id).toBe("uniao.despesas.saude");
  });
  it("troca a esfera mantendo o caminho relativo", () => {
    expect(relId("SP.despesas.saude")).toBe("despesas.saude");
    expect(withPrefix("SP.despesas.saude", "estados")).toBe("estados.despesas.saude");
  });
  it("soma filhos e detecta bases diferentes", () => {
    expect(sumChildren(arvore)).toBe(100);
    expect(hasMixedBases(arvore)).toBe(false);
    expect(hasMixedBases(arvore.filhos![0]!)).toBe(true);
  });
  it("busca sem acento e devolve ancestrais visíveis", () => {
    const r = searchTree(arvore, "previdencia");
    expect([...r.matches]).toEqual(["uniao.despesas.previdencia"]);
    const r2 = searchTree(arvore, "RURAL");
    expect(r2.visible.has("uniao.despesas")).toBe(true);
    expect(r2.visible.has("uniao.despesas.saude")).toBe(false);
  });
  it("lista os nós visíveis respeitando expansão", () => {
    const v = visibleNodes(arvore, new Set(["uniao.despesas"]));
    expect(v.map((x) => x.node.id)).toEqual(["uniao.despesas", "uniao.despesas.previdencia", "uniao.despesas.saude"]);
    expect(v[1]!.level).toBe(2);
  });
  it("gera CSV com separador ; e vírgula decimal", () => {
    const csv = toCSV({ ...arvore, valor: 100.5 });
    const linhas = csv.replace("﻿", "").split("\n");
    expect(linhas[0]).toContain("id;nome;valor_R$_milhoes");
    expect(linhas[1]).toContain("100,5");
    expect(linhas).toHaveLength(4);
  });
});
