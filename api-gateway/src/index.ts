import axios from "axios";
import cors from "cors";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import {
  ORIGENS_PERMITIDAS,
  PEDIDOS_SERVICE_URL,
  PORT,
  PRODUTOS_SERVICE_URL,
} from "./config.js";
import { log } from "./logger.js";
import { requestId } from "./middleware/requestId.js";

const app = express();

// 1) CORS: o navegador só deixa o React (porta 5173) chamar o gateway (porta 3000)
//    se o gateway disser explicitamente que aceita essa origem.
//    Configurar CORS SÓ AQUI evita repeti-lo em cada microsserviço.
app.use(cors({ origin: ORIGENS_PERMITIDAS, exposedHeaders: ["x-request-id"] }));

// 2) Rastreabilidade: gera/propaga o x-request-id e registra cada requisição.
app.use(requestId);

// IMPORTANTE: não usamos express.json() antes dos proxies. O proxy precisa
// receber o corpo da requisição "cru" (stream) para repassá-lo ao serviço.

/**
 * Cria um proxy reverso para um serviço interno.
 *
 *   pathFilter:  quais URLs do gateway este proxy atende
 *   pathRewrite: como a URL é reescrita antes de chegar ao serviço
 *                ex.: /api/produtos/1  ->  /produtos/1
 *   on.error:    o que responder se o serviço estiver fora do ar
 */
function criarProxy(prefixo: string, destino: string, nomeServico: string) {
  return createProxyMiddleware({
    target: destino,
    changeOrigin: true,
    pathFilter: prefixo,
    pathRewrite: { [`^${prefixo}`]: prefixo.replace("/api", "") },
    on: {
      error: (err, req, res) => {
        const id = String((req as { headers: Record<string, unknown> }).headers["x-request-id"] ?? "");
        log.erro(id, `${nomeServico} indisponível (${(err as NodeJS.ErrnoException).code ?? err.message}). Respondendo 503.`);
        // `res` pode ser um Socket em upgrades de WebSocket; aqui só tratamos HTTP.
        if ("writeHead" in res && !res.headersSent) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              erro: `O serviço "${nomeServico}" está indisponível no momento.`,
            }),
          );
        }
      },
    },
  });
}

// 3) Tabela de roteamento: é aqui que o "mapa" do sistema fica visível.
app.use(criarProxy("/api/produtos", PRODUTOS_SERVICE_URL, "produtos-service"));
app.use(criarProxy("/api/pedidos", PEDIDOS_SERVICE_URL, "pedidos-service"));

// 4) Health check agregado: pergunta a cada serviço se está vivo.
app.get("/health", async (_req, res) => {
  const servicos = [
    { nome: "produtos-service", url: PRODUTOS_SERVICE_URL },
    { nome: "pedidos-service", url: PEDIDOS_SERVICE_URL },
  ];

  const resultados = await Promise.all(
    servicos.map(async ({ nome, url }) => {
      try {
        await axios.get(`${url}/health`, { timeout: 1500 });
        return [nome, "ok"] as const;
      } catch {
        return [nome, "indisponivel"] as const;
      }
    }),
  );

  const detalhes = Object.fromEntries(resultados);
  const tudoOk = resultados.every(([, status]) => status === "ok");

  // Mesmo com um serviço fora, o próprio gateway está de pé: devolvemos 200
  // quando tudo está ok e 503 quando há degradação, para sinalizar a quem monitora.
  res.status(tudoOk ? 200 : 503).json({
    servico: "api-gateway",
    status: tudoOk ? "ok" : "degradado",
    dependencias: detalhes,
  });
});

app.use((_req, res) => {
  res.status(404).json({ erro: "Rota não encontrada no gateway." });
});

// No Express 5, o callback do listen recebe o erro (ex.: porta já em uso).
app.listen(PORT, (erro?: Error) => {
  if (erro) {
    log.erro(undefined, `não foi possível iniciar na porta ${PORT}: ${erro.message}`);
    log.info(undefined, "Dica: libere a porta ou defina outra com a variável PORT.");
    process.exit(1);
  }
  log.info(undefined, `▶ rodando em http://localhost:${PORT}`);
  log.info(undefined, `  /api/produtos → ${PRODUTOS_SERVICE_URL}`);
  log.info(undefined, `  /api/pedidos  → ${PEDIDOS_SERVICE_URL}`);
});
