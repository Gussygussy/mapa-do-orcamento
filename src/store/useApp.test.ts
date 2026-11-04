import { rootId, stateFromURL, urlFromState, useApp } from "./useApp";

describe("URL compartilhável", () => {
  it("lê o nó e deduz esfera e modo", () => {
    expect(stateFromURL("?no=uniao.despesas.previdencia_social")).toMatchObject({
      esfera: "uniao",
      modo: "despesas",
      selectedId: "uniao.despesas.previdencia_social",
    });
    expect(stateFromURL("?no=SP.receitas.correntes")).toMatchObject({ esfera: "estado", uf: "SP", modo: "receitas" });
    expect(stateFromURL("?no=estados.despesas.saude&esfera=comparar&unidade=per_capita")).toMatchObject({
      esfera: "comparar",
      unidade: "per_capita",
    });
  });
  it("ignora valores inválidos", () => {
    const s = stateFromURL("?unidade=xyz&viz=pizza&modo=nada");
    expect(s.unidade).toBeUndefined();
    expect(s.viz).toBeUndefined();
    expect(s.modo).toBeUndefined();
  });
  it("ida e volta preserva o estado", () => {
    const st = { modo: "saldo" as const, esfera: "uniao" as const, uf: "SP", unidade: "pct_pib" as const, viz: "barras" as const, selectedId: "uniao.despesas.saude" };
    const url = urlFromState(st);
    expect(url).toBe("?no=uniao.despesas.saude&modo=saldo&unidade=pct_pib&viz=barras");
    expect(stateFromURL(url)).toMatchObject({ modo: "saldo", unidade: "pct_pib", viz: "barras", selectedId: "uniao.despesas.saude" });
  });
  it("raiz de cada esfera", () => {
    expect(rootId("uniao", "SP", "saldo")).toBe("uniao.despesas");
    expect(rootId("estado", "BA", "receitas")).toBe("BA.receitas");
    expect(rootId("comparar", "SP", "despesas")).toBe("estados.despesas");
    expect(rootId("municipios", "SP", "receitas")).toBe("municipios.despesas");
  });
});

describe("ações do store", () => {
  beforeEach(() => useApp.setState({ modo: "despesas", esfera: "uniao", uf: "SP", unidade: "reais", selectedId: null }));
  it("ao trocar de esfera mantém o caminho relativo do nó", () => {
    useApp.getState().select("uniao.despesas.saude");
    useApp.getState().setEsfera("estados");
    expect(useApp.getState().selectedId).toBe("estados.despesas.saude");
    useApp.getState().setUf("RJ");
    expect(useApp.getState()).toMatchObject({ esfera: "estado", selectedId: "RJ.despesas.saude" });
  });
  it("comparar estados não usa % do PIB", () => {
    useApp.getState().setUnidade("pct_pib");
    useApp.getState().setEsfera("comparar");
    expect(useApp.getState().unidade).toBe("per_capita");
  });
  it("trocar de despesas para receitas volta à raiz", () => {
    useApp.getState().select("uniao.despesas.saude");
    useApp.getState().setModo("saldo");
    expect(useApp.getState().selectedId).toBe("uniao.despesas.saude");
    useApp.getState().setModo("receitas");
    expect(useApp.getState().selectedId).toBeNull();
  });
});
