import express from "express";
import type { NextFunction, Request, Response } from "express";
import { log } from "./logger.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { produtosRouter } from "./routes/produtos.js";

const PORT = Number(process.env.PORT ?? 3001);

const app = express();

// Repare: NÃO há CORS aqui. Serviços internos não são chamados por navegadores;
// quem fala com o navegador é o api-gateway, e é lá que o CORS é configurado.
app.use(express.json());
app.use(requestLogger);

// Health check: usado pelo gateway, pelo Docker e por orquestradores (Kubernetes)
// para saber se o serviço está de pé.
app.get("/health", (_req, res) => {
  res.json({ servico: "produtos-service", status: "ok" });
});

app.use("/produtos", produtosRouter);

app.use((_req, res) => {
  res.status(404).json({ erro: "Rota não encontrada." });
});

// Tratador de erros central (4 parâmetros = middleware de erro do Express).
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  log.erro(res.locals.requestId, `erro não tratado: ${err.message}`);
  res.status(500).json({ erro: "Erro interno no produtos-service." });
});

// No Express 5, o callback do listen recebe o erro (ex.: porta já em uso).
app.listen(PORT, (erro?: Error) => {
  if (erro) {
    log.erro(undefined, `não foi possível iniciar na porta ${PORT}: ${erro.message}`);
    log.info(undefined, "Dica: libere a porta ou defina outra com a variável PORT.");
    process.exit(1);
  }
  log.info(undefined, `▶ rodando em http://localhost:${PORT}`);
});
