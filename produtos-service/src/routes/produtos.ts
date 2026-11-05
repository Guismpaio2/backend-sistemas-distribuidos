import { Router } from "express";
import { buscarPorId, produtos } from "../data/produtos.js";

export const produtosRouter = Router();

/** Converte o parâmetro de rota em inteiro positivo; devolve null se for inválido. */
function lerId(valor: unknown): number | null {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** GET /produtos — lista todos os produtos. */
produtosRouter.get("/", (_req, res) => {
  res.json(produtos);
});

/** GET /produtos/:id — devolve um produto ou 404. */
produtosRouter.get("/:id", (req, res) => {
  const id = lerId(req.params.id);
  if (id === null) {
    res.status(400).json({ erro: "O id do produto deve ser um inteiro positivo." });
    return;
  }

  const produto = buscarPorId(id);
  if (!produto) {
    res.status(404).json({ erro: `Produto ${id} não encontrado.` });
    return;
  }

  res.json(produto);
});

/**
 * POST /produtos/:id/estoque/baixa  { quantidade }
 *
 * Chamado pelo pedidos-service depois de validar uma compra. Fica no
 * produtos-service porque SÓ ELE é dono do estoque.
 * Responde 409 (conflito) se não houver unidades suficientes.
 */
produtosRouter.post("/:id/estoque/baixa", (req, res) => {
  const id = lerId(req.params.id);
  const quantidade = Number(req.body?.quantidade);

  if (id === null || !Number.isInteger(quantidade) || quantidade <= 0) {
    res.status(400).json({ erro: "Informe um id válido e uma quantidade inteira positiva." });
    return;
  }

  const produto = buscarPorId(id);
  if (!produto) {
    res.status(404).json({ erro: `Produto ${id} não encontrado.` });
    return;
  }

  if (produto.estoque < quantidade) {
    res.status(409).json({
      erro: `Estoque insuficiente: disponível ${produto.estoque}, solicitado ${quantidade}.`,
    });
    return;
  }

  // Node.js executa este código em uma única thread, então a verificação
  // acima e a subtração abaixo não podem ser intercaladas por outra requisição.
  // (Em um banco real, isso exigiria uma transação ou um UPDATE condicional.)
  produto.estoque -= quantidade;
  res.json(produto);
});

/**
 * POST /produtos/:id/estoque/devolucao  { quantidade }
 *
 * Operação COMPENSATÓRIA: desfaz uma baixa de estoque quando algo falha
 * depois dela (ver o padrão Saga na pesquisa de Teoria).
 */
produtosRouter.post("/:id/estoque/devolucao", (req, res) => {
  const id = lerId(req.params.id);
  const quantidade = Number(req.body?.quantidade);

  if (id === null || !Number.isInteger(quantidade) || quantidade <= 0) {
    res.status(400).json({ erro: "Informe um id válido e uma quantidade inteira positiva." });
    return;
  }

  const produto = buscarPorId(id);
  if (!produto) {
    res.status(404).json({ erro: `Produto ${id} não encontrado.` });
    return;
  }

  produto.estoque += quantidade;
  res.json(produto);
});
