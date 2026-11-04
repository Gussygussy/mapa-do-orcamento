import { arvoreMunicipio, expandir, rotuloMunicipio, type MunicipioArquivo } from "./municipio";
import { sumChildren } from "./tree";

const fonte = { nome: "DCA 2025", url: "https://exemplo.gov.br" };
const arq: MunicipioArquivo = {
  cod: 3550308,
  nome: "São Paulo",
  uf: "SP",
  pop: 11_900_000,
  fontes: { despesas: fonte, receitas: null },
  despesas: {
    n: "Despesas – São Paulo (SP)",
    v: 100,
    s: "despesas",
    c: [
      { n: "Saúde", v: 60, s: "saude", c: [{ n: "Atenção Básica", v: 60, s: "atencao_basica" }] },
      { n: "Outros / não detalhado", v: 40, s: "outros", e: 1 },
    ],
  },
  receitas: null,
};

describe("formato compacto dos municípios", () => {
  it("reconstrói ids, base e fonte", () => {
    const t = arvoreMunicipio(arq, "despesas")!;
    expect(t.id).toBe("m3550308.despesas");
    expect(t.base).toBe("empenhado");
    expect(t.filhos![0]!.filhos![0]!.id).toBe("m3550308.despesas.saude.atencao_basica");
    expect(t.filhos![0]!.fonte[0]).toEqual(fonte);
    expect(sumChildren(t)).toBe(100);
  });
  it("marca 'Outros' como estimativa com nota", () => {
    const outros = expandir(arq.despesas!, "m1", "empenhado", fonte).filhos![1]!;
    expect(outros.estimado).toBe(true);
    expect(outros.nota).toMatch(/Diferença/);
  });
  it("devolve null quando o município não enviou o dado", () => {
    expect(arvoreMunicipio(arq, "receitas")).toBeNull();
  });
  it("rótulo de busca", () => {
    expect(rotuloMunicipio([3550308, "São Paulo", "SP", 1, 1, 1])).toBe("São Paulo (SP)");
  });
});
