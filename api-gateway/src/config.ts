/**
 * Configuração do gateway (lida de variáveis de ambiente, com padrões locais).
 *
 * O gateway é o ÚNICO componente que conhece o endereço dos serviços internos.
 * O frontend conhece apenas o endereço do gateway.
 */
export const PORT = Number(process.env.PORT ?? 3000);

export const PRODUTOS_SERVICE_URL = process.env.PRODUTOS_SERVICE_URL ?? "http://localhost:3001";
export const PEDIDOS_SERVICE_URL = process.env.PEDIDOS_SERVICE_URL ?? "http://localhost:3002";

/** Origens autorizadas a chamar o gateway pelo navegador (CORS). Separe várias por vírgula. */
export const ORIGENS_PERMITIDAS = (
  process.env.CORS_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
