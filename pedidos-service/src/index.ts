import express from "express";
import type { NextFunction, Request, Response } from "express";
import {
  EstoqueInsuficienteError,
  ProdutoNaoEncontradoError,
  ServicoIndisponivelError,
} from "./clients/produtosClient.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { pedidosRouter } from "./routes/pedidos.js";

const PORT = Number(process.env.PORT ?? 3002);

const app = express();

// Sem CORS aqui: só o api-gateway é exposto a navegadores (ver api-gateway/src/index.ts).
app.use(express.json());
app.use(requestLogger);

app.get("/health", (_req, res) => {
  res.json({ servico: "pedidos-service", status: "ok" });
});

app.use("/pedidos", pedidosRouter);

app.use((_req, res) => {
  res.status(404).json({ erro: "Rota não encontrada." });
});

/**
 * Tratador de erros central: traduz os erros de domínio (vindos da conversa
 * com o produtos-service) em códigos HTTP adequados.
 *
 *   404 -> produto não existe
 *   409 -> estoque insuficiente
 *   503 -> produtos-service fora do ar (o pedidos-service continua vivo!)
 */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ProdutoNaoEncontradoError) {
    res.status(404).json({ erro: err.message });
    return;
  }
  if (err instanceof EstoqueInsuficienteError) {
    res.status(409).json({ erro: err.message });
    return;
  }
  if (err instanceof ServicoIndisponivelError) {
    console.warn(`[pedidos-service] [${res.locals.requestId}] ${err.message}`);
    res.status(503).json({ erro: err.message });
    return;
  }

  console.error("[pedidos-service] erro não tratado:", err);
  res.status(500).json({ erro: "Erro interno no pedidos-service." });
});

// No Express 5, o callback do listen recebe o erro (ex.: porta já em uso).
app.listen(PORT, (erro?: Error) => {
  if (erro) {
    console.error(`[pedidos-service] não foi possível iniciar na porta ${PORT}:`, erro.message);
    console.error("Dica: libere a porta ou defina outra com a variável PORT.");
    process.exit(1);
  }
  console.log(`[pedidos-service] rodando em http://localhost:${PORT}`);
});
