import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const NOME_SERVICO = "produtos-service";

/**
 * Rastreabilidade simples (versão didática do "trace id" de sistemas reais).
 *
 * O api-gateway gera um cabeçalho `x-request-id` e o repassa adiante.
 * Aqui nós o reaproveitamos (ou criamos um, se a chamada vier direto) e o
 * escrevemos em cada linha de log. Assim é possível seguir UMA requisição
 * do usuário por todos os serviços procurando o mesmo id nos logs.
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
