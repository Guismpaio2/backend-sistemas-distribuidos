import type { NextFunction, Request, Response } from "express";
import { idSeguro, log, registrarHealth } from "../logger.js";

/**
 * Rastreabilidade simples (versão didática do "trace id" de sistemas reais).
 *
 * O api-gateway gera um cabeçalho `x-request-id` e o repassa adiante.
 * Aqui reaproveitamos esse id (ou criamos um, se a chamada vier direto) e o
 * escrevemos em cada linha de log. Assim é possível seguir UMA requisição
 * do usuário por todos os serviços procurando o mesmo id nos logs.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const id = idSeguro(req.header("x-request-id"));
  res.locals.requestId = id;
  res.setHeader("x-request-id", id);

  // /health é consultado de tempos em tempos; registrá-lo só atrapalharia a leitura.
  if (req.path === "/health" && !registrarHealth) {
    next();
    return;
  }

  const inicio = Date.now();
  res.on("finish", () => {
    log.http(id, req.method, req.originalUrl, res.statusCode, Date.now() - inicio);
  });

  next();
}
