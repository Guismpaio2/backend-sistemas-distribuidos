import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Atribui um identificador único a cada requisição que ENTRA no sistema.
 *
 * O gateway é o lugar ideal para isso: ele é a porta de entrada, então toda
 * requisição passa por aqui primeiro. O id é:
 *   - repassado aos serviços internos (cabeçalho `x-request-id`), e
 *   - devolvido ao cliente na resposta, para facilitar suporte e depuração.
 *
 * É uma versão simplificada do que o OpenTelemetry/W3C Trace Context faz.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = req.header("x-request-id") ?? randomUUID();
  req.headers["x-request-id"] = id; // o proxy copia os cabeçalhos da requisição
  res.setHeader("x-request-id", id);
  res.locals.requestId = id;

  const inicio = Date.now();
  res.on("finish", () => {
    console.log(
      `[api-gateway] [${id}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - inicio}ms)`,
    );
  });

  next();
}
