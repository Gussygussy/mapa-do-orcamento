import { formatBRL, formatIndicador, formatPct, formatReais } from "./format";
import { formatMetric, metric } from "./units";

describe("formatBRL (entrada em R$ milhões)", () => {
  it("usa tri, bi, mi e mil como no CLAUDE.md", () => {
    expect(formatBRL(1_100_000)).toBe("R$ 1,10 tri");
    expect(formatBRL(240_177)).toBe("R$ 240,2 bi");
    expect(formatBRL(850)).toBe("R$ 850 mi");
    expect(formatBRL(3.52)).toBe("R$ 3,5 mi");
    expect(formatBRL(0.12)).toBe("R$ 120 mil");
  });
  it("mostra negativos com sinal de menos", () => {
    expect(formatBRL(-317_158)).toBe("−R$ 317,2 bi");
  });
  it("não inventa número para valor ausente", () => {
    expect(formatBRL(NaN)).toBe("dado não disponível");
  });
});

describe("outros formatos", () => {
  it("formata percentuais e reais", () => {
    expect(formatPct(28.14)).toBe("28,1%");
    expect(formatPct(0.05)).toBe("0,05%");
    expect(formatReais(18434.2)).toBe("R$ 18.434");
  });
  it("formata indicador conforme a unidade", () => {
    expect(formatIndicador(35_173_071, "benefícios")).toBe("35.173.071 benefícios");
    expect(formatIndicador(46, "%")).toBe("46,0%");
    expect(formatIndicador(709_714, "R$ mi")).toBe("R$ 709,7 bi");
  });
});

describe("unidades", () => {
  const base = { total: 4000, pib: 12_738_566, pop: 213_421_037 };
  it("converte para % do total, % do PIB e per capita", () => {
    expect(metric(1000, { ...base, unidade: "pct_total" })).toBeCloseTo(25);
    expect(metric(1_273_856.6, { ...base, unidade: "pct_pib" })).toBeCloseTo(10);
    expect(metric(213.421037, { ...base, unidade: "per_capita" })).toBeCloseTo(1);
    expect(formatMetric(213_421.037, { ...base, unidade: "per_capita" })).toBe("R$ 1.000/hab.");
  });
  it("sem população não calcula per capita", () => {
    expect(formatMetric(100, { ...base, pop: NaN, unidade: "per_capita" })).toBe("dado não disponível");
  });
});
