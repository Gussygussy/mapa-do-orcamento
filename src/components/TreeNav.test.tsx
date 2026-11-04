import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { Node } from "../types";
import { TreeNav } from "./TreeNav";

const f = [{ nome: "Teste", url: "https://exemplo.gov.br" }];
const raiz: Node = {
  id: "uniao.despesas",
  nome: "Despesas da União",
  valor: 1000,
  base: "empenhado",
  fonte: f,
  filhos: [
    {
      id: "uniao.despesas.previdencia",
      nome: "Previdência Social",
      valor: 600,
      base: "empenhado",
      fonte: f,
      filhos: [{ id: "uniao.despesas.previdencia.rural", nome: "Benefícios rurais", valor: 600, base: "caixa", fonte: f }],
    },
    { id: "uniao.despesas.saude", nome: "Saúde", valor: 400, base: "empenhado", fonte: f },
  ],
};
const ctx = { unidade: "reais" as const, total: 1000, pib: 10000, pop: 1000 };

function Harness({ onSelect }: { onSelect: (id: string) => void }) {
  const [sel, setSel] = useState(raiz.id);
  return (
    <TreeNav
      root={raiz}
      selectedId={sel}
      ctx={ctx}
      onSelect={(id) => {
        setSel(id);
        onSelect(id);
      }}
    />
  );
}

describe("TreeNav", () => {
  it("tem papéis ARIA de árvore e mostra valor e % do pai", () => {
    render(<Harness onSelect={() => {}} />);
    expect(screen.getByRole("tree")).toBeInTheDocument();
    const itens = screen.getAllByRole("treeitem");
    expect(itens).toHaveLength(3);
    expect(itens[0]).toHaveAttribute("aria-expanded", "true");
    expect(itens[0]).toHaveAttribute("aria-selected", "true");
    expect(itens[1]).toHaveTextContent("R$ 600 mi");
    expect(itens[1]).toHaveTextContent("60,0%");
  });

  it("navega por teclado: setas e Enter", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    screen.getAllByRole("treeitem")[0]!.focus();
    await user.keyboard("{ArrowDown}{ArrowRight}{ArrowRight}{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith("uniao.despesas.previdencia.rural");
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toHaveTextContent("Previdência Social");
  });

  it("busca filtra a árvore e destaca o termo", async () => {
    const user = userEvent.setup();
    render(<Harness onSelect={() => {}} />);
    await user.type(screen.getByLabelText("Buscar na árvore"), "rurais");
    expect(screen.getByText("1 item encontrado")).toBeInTheDocument();
    expect(screen.queryByText("Saúde")).not.toBeInTheDocument();
    expect(screen.getByText("rurais", { selector: "mark" })).toBeInTheDocument();
  });
});
