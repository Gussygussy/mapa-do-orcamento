import { rootId, stateFromURL, urlFromState, useApp } from "./useApp";

const base = { uf: "SP", munEscopo: "brasil" as const, munUf: "SP", munCod: null, camada: "estados" as const };

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
      camada: "estados",
      unidade: "per_capita",
    });
  });
  it("lê municípios: todos, de uma UF e um município", () => {
    expect(stateFromURL("?no=municipios.receitas")).toMatchObject({ esfera: "municipios", munEscopo: "brasil", modo: "receitas" });
    expect(stateFromURL("?no=m-MG.despesas.saude")).toMatchObject({ esfera: "municipios", munEscopo: "uf", munUf: "MG" });
    expect(stateFromURL("?no=m3550308.despesas.educacao")).toMatchObject({
      esfera: "municipios",
      munEscopo: "municipio",
      munCod: 3550308,
    });
    expect(stateFromURL("?no=municipios.despesas&esfera=comparar&camada=municipios")).toMatchObject({ camada: "municipios" });
  });
  it("ignora valores inválidos", () => {
    const s = stateFromURL("?unidade=xyz&viz=pizza&modo=nada");
    expect(s.unidade).toBeUndefined();
    expect(s.viz).toBeUndefined();
    expect(s.modo).toBeUndefined();
  });
  it("ida e volta preserva o estado", () => {
    const st = { ...base, modo: "saldo" as const, esfera: "uniao" as const, unidade: "pct_pib" as const, viz: "barras" as const, selectedId: "uniao.despesas.saude" };
    const url = urlFromState(st);
    expect(url).toBe("?no=uniao.despesas.saude&modo=saldo&unidade=pct_pib&viz=barras");
    expect(stateFromURL(url)).toMatchObject({ modo: "saldo", unidade: "pct_pib", viz: "barras", selectedId: "uniao.despesas.saude" });
  });
  it("raiz de cada esfera", () => {
    expect(rootId({ ...base, esfera: "uniao" }, "saldo")).toBe("uniao.despesas");
    expect(rootId({ ...base, esfera: "estado", uf: "BA" }, "receitas")).toBe("BA.receitas");
    expect(rootId({ ...base, esfera: "comparar" }, "despesas")).toBe("estados.despesas");
    expect(rootId({ ...base, esfera: "comparar", camada: "municipios" }, "despesas")).toBe("municipios.despesas");
    expect(rootId({ ...base, esfera: "municipios" }, "receitas")).toBe("municipios.receitas");
    expect(rootId({ ...base, esfera: "municipios", munEscopo: "uf", munUf: "RS" }, "despesas")).toBe("m-RS.despesas");
    expect(rootId({ ...base, esfera: "municipios", munEscopo: "municipio", munCod: 4314902 }, "despesas")).toBe("m4314902.despesas");
  });
});

describe("ações do store", () => {
  beforeEach(() =>
    useApp.setState({ ...base, modo: "despesas", esfera: "uniao", unidade: "reais", selectedId: null }),
  );
  it("ao trocar de esfera mantém o caminho relativo do nó", () => {
    useApp.getState().select("uniao.despesas.saude");
    useApp.getState().setEsfera("estados");
    expect(useApp.getState().selectedId).toBe("estados.despesas.saude");
    useApp.getState().setUf("RJ");
    expect(useApp.getState()).toMatchObject({ esfera: "estado", selectedId: "RJ.despesas.saude" });
  });
  it("leva o nó para municípios de uma UF e para um município", () => {
    useApp.getState().select("RJ.despesas.saude");
    useApp.getState().setMunUf("RJ");
    expect(useApp.getState()).toMatchObject({ esfera: "municipios", munEscopo: "uf", selectedId: "m-RJ.despesas.saude" });
    useApp.getState().setMunCod(3304557);
    expect(useApp.getState()).toMatchObject({ munEscopo: "municipio", munCod: 3304557, selectedId: "m3304557.despesas.saude" });
  });
  it("municípios e comparar não têm modo Saldo", () => {
    useApp.getState().setModo("saldo");
    useApp.getState().setEsfera("municipios");
    expect(useApp.getState().modo).toBe("despesas");
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
