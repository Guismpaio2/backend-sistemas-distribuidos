import type { NextFunction, Request, Response } from "express";
import { gerarId, idSeguro, log, registrarHealth } from "../logger.js";

/** Descobre para qual serviço interno a requisição será encaminhada (só para o log). */
function destinoDe(url: string): string | undefined {
  if (url.startsWith("/api/produtos")) return "produtos";
  if (url.startsWith("/api/pedidos")) return "pedidos";
  return undefined;
}

/**
 * Atribui um identificador único a cada requisição que ENTRA no sistema.
 *
 * O gateway é o lugar ideal para isso: ele é a porta de entrada, então toda
 * requisição passa por aqui primeiro. O id (6 caracteres, ex.: "a3f9c1") é:
 *   - repassado aos serviços internos (cabeçalho `x-request-id`), e
 *   - devolvido ao cliente na resposta, para facilitar suporte e depuração.
 *
 * É uma versão simplificada do que o OpenTelemetry/W3C Trace Context faz.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = req.header("x-request-id") ? idSeguro(req.header("x-request-id")) : gerarId();
  req.headers["x-request-id"] = id; // o proxy copia os cabeçalhos da requisição
  res.setHeader("x-request-id", id);
  res.locals.requestId = id;

  // /health é consultado de tempos em tempos; registrá-lo só atrapalharia a leitura.
  if (req.path === "/health" && !registrarHealth) {
    next();
    return;
  }

  const inicio = Date.now();
  res.on("finish", () => {
    log.http(id, req.method, req.originalUrl, res.statusCode, Date.now() - inicio, destinoDe(req.originalUrl));
  });

  next();
}
