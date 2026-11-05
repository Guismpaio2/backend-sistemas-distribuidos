import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const NOME_SERVICO = "pedidos-service";

/**
 * Registra cada requisição com o `x-request-id` recebido do api-gateway.
 * (Cópia intencional do mesmo middleware do produtos-service: em microsserviços
 * cada serviço é independente e não compartilha código em tempo de execução.)
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.header("x-request-id") ?? randomUUID()).toString();
  res.locals.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  const inicio = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - inicio;
    console.log(
      `[${NOME_SERVICO}] [${requestId}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`,
    );
  });

  next();
}
