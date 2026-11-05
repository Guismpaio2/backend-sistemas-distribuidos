/**
 * Logger compacto do serviço.
 *
 * Objetivo: tornar legível o log de VÁRIOS serviços rodando no mesmo terminal.
 * Cada linha segue sempre o mesmo formato, em colunas:
 *
 *   HH:MM:SS  serviço   id      mensagem
 *   14:02:11  gateway   a3f9c1  POST   /api/pedidos      → pedidos   201    12ms
 *   14:02:11  produtos  a3f9c1  GET    /produtos/2                  200     1ms
 *   14:02:11  pedidos   a3f9c1    ↳ chama produtos-service: GET /produtos/2 → 200 (4ms)
 *   14:02:11  pedidos   a3f9c1  ✔ pedido #3 criado: 2× Mouse (R$ 259,80)
 *
 * - O ID CURTO (6 caracteres) é o "trace id" didático: todas as linhas de uma
 *   mesma compra, em qualquer serviço, têm o mesmo id. Basta procurá-lo.
 * - Cores: verde 2xx, ciano 3xx, amarelo 4xx, vermelho 5xx. Respeita NO_COLOR.
 * - Chamadas ao /health (feitas a cada poucos segundos pelo frontend e pelo
 *   gateway) NÃO são registradas, para não encher o terminal.
 *   Para vê-las, defina LOG_HEALTH=1.
 *
 * (Cada serviço tem sua cópia deste arquivo: em microsserviços não se
 *  compartilha código em tempo de execução. Só NOME e COR_NOME mudam.)
 */
import { randomUUID } from "node:crypto";

const NOME = "pedidos";
const COR_NOME = "1;95"; // negrito + magenta claro
const LARGURA_ID = 6;

const usarCor =
  process.env.NO_COLOR === undefined &&
  (process.env.FORCE_COLOR !== undefined
    ? process.env.FORCE_COLOR !== "0"
    : Boolean(process.stdout.isTTY));

const pintar = (codigo: string, texto: string) =>
  usarCor ? `\x1b[${codigo}m${texto}\x1b[0m` : texto;
const apagado = (texto: string) => pintar("2", texto);

/** true se o usuário pediu para registrar também as chamadas de /health. */
export const registrarHealth = process.env.LOG_HEALTH === "1";

/** Gera um id curto (6 hexadecimais). Suficiente para uma demonstração. */
export function gerarId(): string {
  return randomUUID().replaceAll("-", "").slice(0, LARGURA_ID);
}

/**
 * Aceita o id recebido no cabeçalho somente se tiver caracteres seguros
 * (evita que um cliente injete texto estranho nos logs); senão gera um novo.
 */
export function idSeguro(valor: string | undefined): string {
  return valor && /^[\w.-]{1,64}$/.test(valor) ? valor : gerarId();
}

function hora(): string {
  return new Date().toLocaleTimeString("pt-BR", { hour12: false });
}

function escrever(id: string | undefined, texto: string): void {
  const colunaId = (id ?? "").slice(0, LARGURA_ID).padEnd(LARGURA_ID);
  console.log(
    `${apagado(hora())}  ${pintar(COR_NOME, NOME.padEnd(8))}  ${apagado(colunaId)}  ${texto}`,
  );
}

function pintarStatus(status: number): string {
  const codigo = status >= 500 ? "1;31" : status >= 400 ? "33" : status >= 300 ? "36" : "32";
  return pintar(codigo, String(status));
}

export const log = {
  /** Linha de uma requisição recebida: método, caminho, [destino], status e duração. */
  http(
    id: string,
    metodo: string,
    url: string,
    status: number,
    ms: number,
    destino?: string,
  ): void {
    const alvo = destino ? apagado(`→ ${destino}`.padEnd(11)) : "";
    const duracao = ms >= 500 ? pintar("33", `${ms}ms`.padStart(7)) : apagado(`${ms}ms`.padStart(7));
    escrever(id, `${metodo.padEnd(6)} ${url.padEnd(26)} ${alvo} ${pintarStatus(status)} ${duracao}`);
  },

  /** Chamada FEITA por este serviço a outro (ex.: pedidos → produtos). */
  saida(
    id: string,
    metodo: string,
    servico: string,
    caminho: string,
    status: number | "ERRO",
    ms: number,
    detalhe?: string,
  ): void {
    const resultado =
      status === "ERRO"
        ? pintar("1;31", `falhou${detalhe ? ` (${detalhe})` : ""}`)
        : pintarStatus(status);
    escrever(id, `  ${apagado("↳")} chama ${servico}: ${metodo} ${caminho} → ${resultado} ${apagado(`(${ms}ms)`)}`);
  },

  info(id: string | undefined, texto: string): void {
    escrever(id, texto);
  },
  ok(id: string | undefined, texto: string): void {
    escrever(id, pintar("32", `✔ ${texto}`));
  },
  aviso(id: string | undefined, texto: string): void {
    escrever(id, pintar("33", `⚠ ${texto}`));
  },
  erro(id: string | undefined, texto: string): void {
    escrever(id, pintar("1;31", `✖ ${texto}`));
  },
};
