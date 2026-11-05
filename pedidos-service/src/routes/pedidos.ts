import { Router } from "express";
import { baixarEstoque, buscarProduto, devolverEstoque } from "../clients/produtosClient.js";
import { buscarPedido, criarPedido, pedidos } from "../data/pedidos.js";

export const pedidosRouter = Router();

/** GET /pedidos — lista os pedidos (mais recentes primeiro). */
pedidosRouter.get("/", (_req, res) => {
  res.json([...pedidos].reverse());
});

/** GET /pedidos/:id */
pedidosRouter.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const pedido = Number.isInteger(id) ? buscarPedido(id) : undefined;

  if (!pedido) {
    res.status(404).json({ erro: `Pedido ${req.params.id} não encontrado.` });
    return;
  }
  res.json(pedido);
});

/**
 * POST /pedidos  { productId, quantidade }
 *
 * Fluxo (uma "saga orquestrada" mínima, executada de forma síncrona):
 *
 *   1. GET  produtos-service /produtos/:id             -> o produto existe? qual o preço?
 *   2. POST produtos-service /produtos/:id/estoque/baixa -> reserva as unidades
 *   3. grava o pedido no banco LOCAL deste serviço
 *      └─ se o passo 3 falhar, executa a COMPENSAÇÃO: devolve o estoque (passo 2')
 *
 * Não existe uma transação única que cubra os dois serviços (cada um tem
 * seu próprio dado). Por isso precisamos compensar manualmente.
 *
 * No Express 5, erros lançados dentro de handlers async são encaminhados
 * automaticamente para o tratador de erros central (ver index.ts).
 */
pedidosRouter.post("/", async (req, res) => {
  const requestId: string = res.locals.requestId;
  const { productId, quantidade } = req.body ?? {};

  // ---- Validação da entrada ----
  if (!Number.isInteger(productId) || productId <= 0) {
    res.status(400).json({ erro: "O campo 'productId' deve ser um inteiro positivo." });
    return;
  }
  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    res.status(400).json({ erro: "O campo 'quantidade' deve ser um inteiro positivo." });
    return;
  }

  // ---- Passo 1: comunicação REAL entre serviços (HTTP) ----
  const produto = await buscarProduto(productId, requestId);

  if (produto.estoque < quantidade) {
    res.status(409).json({
      erro: `Estoque insuficiente para "${produto.nome}": disponível ${produto.estoque}, solicitado ${quantidade}.`,
    });
    return;
  }

  // ---- Passo 2: reserva o estoque (pode falhar se outra compra chegou antes) ----
  await baixarEstoque(productId, quantidade, requestId);

  // ---- Passo 3: grava o pedido; se falhar, compensa ----
  try {
    const pedido = criarPedido({
      productId,
      nomeProduto: produto.nome,
      quantidade,
      precoUnitario: produto.preco,
      total: Number((produto.preco * quantidade).toFixed(2)),
      status: "CONFIRMADO",
    });

    console.log(
      `[pedidos-service] [${requestId}] pedido #${pedido.id} criado: ${quantidade}x ${produto.nome}`,
    );
    res.status(201).json(pedido);
  } catch (err) {
    // Transação compensatória: devolve o estoque que já tinha sido baixado.
    await devolverEstoque(productId, quantidade, requestId).catch((e) =>
      console.error(`[pedidos-service] [${requestId}] FALHA ao compensar estoque:`, e),
    );
    throw err;
  }
});
