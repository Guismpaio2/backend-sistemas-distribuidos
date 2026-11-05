#!/usr/bin/env node
/**
 * Sobe os três microsserviços de uma vez, no MESMO terminal.
 *
 *   npm run dev      → modo desenvolvimento (recarrega ao salvar arquivos)
 *   npm start        → modo produção (usa o código compilado em dist/; rode `npm run build` antes)
 *
 * Por que um script próprio, e não o "concurrently"?
 *   - Os serviços herdam o terminal (stdio "inherit"), então o logger deles
 *     detecta que há um terminal e usa cores, sem prefixos duplicados.
 *   - Não passa pelo "npm run": some o texto "> produtos-service@1.0.0 dev".
 *   - Ctrl+C encerra os três e, se um serviço falhar ao iniciar (ex.: porta
 *     ocupada), os outros também são encerrados em vez de ficarem "órfãos".
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const producao = process.argv.includes("--prod");

// Portas (mude-as se alguma já estiver em uso no seu computador):
//   PORTA_PRODUTOS=4001 PORTA_PEDIDOS=4002 PORTA_GATEWAY=4000 npm run dev
const portas = {
  produtos: Number(process.env.PORTA_PRODUTOS ?? 3001),
  pedidos: Number(process.env.PORTA_PEDIDOS ?? 3002),
  gateway: Number(process.env.PORTA_GATEWAY ?? 3000),
};
const urlProdutos = `http://localhost:${portas.produtos}`;
const urlPedidos = `http://localhost:${portas.pedidos}`;

// `env` = variáveis extras de cada serviço (a porta e o endereço dos vizinhos).
const servicos = [
  { pasta: "produtos-service", porta: portas.produtos, env: { PORT: portas.produtos } },
  {
    pasta: "pedidos-service",
    porta: portas.pedidos,
    env: { PORT: portas.pedidos, PRODUTOS_SERVICE_URL: urlProdutos },
  },
  {
    pasta: "api-gateway",
    porta: portas.gateway,
    env: { PORT: portas.gateway, PRODUTOS_SERVICE_URL: urlProdutos, PEDIDOS_SERVICE_URL: urlPedidos },
  },
];

/** Monta o comando (executável + argumentos) de um serviço. */
function comandoDe({ pasta }) {
  if (producao) {
    return { cwd: join(raiz, pasta), arquivo: join(raiz, pasta, "dist", "index.js"), args: ["dist/index.js"] };
  }
  // Usamos o tsx instalado no próprio serviço, chamado direto pelo Node (funciona igual no Windows).
  // --clear-screen=false: sem isso o tsx limpa o terminal a cada reinício e some o histórico.
  const tsx = join(raiz, pasta, "node_modules", "tsx", "dist", "cli.mjs");
  return { cwd: join(raiz, pasta), arquivo: tsx, args: [tsx, "watch", "--clear-screen=false", "src/index.ts"] };
}

// ---- pré-checagens com mensagens claras ----
for (const servico of servicos) {
  const { arquivo } = comandoDe(servico);
  if (!existsSync(arquivo)) {
    console.error(
      producao
        ? `Falta o build de ${servico.pasta}. Rode: npm run build`
        : `Dependências de ${servico.pasta} não instaladas. Rode: npm run install:all`,
    );
    process.exit(1);
  }
}

console.log(
  `Subindo ${servicos.map((s) => `${s.pasta} (:${s.porta})`).join(", ")}${producao ? " [produção]" : ""}.`,
);
console.log("Ctrl+C encerra todos. LOG_HEALTH=1 mostra também as chamadas de /health.\n");

// ---- sobe os processos ----
let encerrando = false;
const filhos = servicos.map((servico) => {
  const { cwd, args } = comandoDe(servico);
  const filho = spawn(process.execPath, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...servico.env },
  });
  filho.on("exit", (codigo, sinal) => {
    if (encerrando) return;
    console.error(`\n${servico.pasta} terminou (${sinal ?? `código ${codigo}`}). Encerrando os demais...`);
    encerrar(codigo || 1);
  });
  return filho;
});

function encerrar(codigoSaida = 0) {
  if (encerrando) return;
  encerrando = true;
  for (const filho of filhos) filho.kill("SIGTERM");
  // Dá um instante para os processos fecharem e sai.
  setTimeout(() => process.exit(codigoSaida), 300);
}

process.on("SIGINT", () => encerrar(0));
process.on("SIGTERM", () => encerrar(0));
