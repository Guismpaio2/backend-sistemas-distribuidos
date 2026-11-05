import axios, { AxiosError } from "axios";

/**
 * Cliente HTTP do produtos-service.
 *
 * Esta é a COMUNICAÇÃO ENTRE SERVIÇOS do laboratório: o pedidos-service não
 * tem acesso ao "banco" de produtos; ele precisa perguntar pela rede.
 *
 * O endereço vem de uma variável de ambiente (padrão de 12-Factor App).
 * Em Docker/Kubernetes seria o nome DNS do serviço, ex.: http://produtos-service:3001.
 */
const PRODUTOS_SERVICE_URL = process.env.PRODUTOS_SERVICE_URL ?? "http://localhost:3001";

// Timeout curto: nunca devemos esperar para sempre por outro serviço.
// Sem timeout, um produtos-service lento deixaria requisições presas aqui
// e a falha se propagaria em cascata.
const http = axios.create({
  baseURL: PRODUTOS_SERVICE_URL,
  timeout: 3000,
});

export interface ProdutoRemoto {
  id: number;
  nome: string;
  preco: number;
  estoque: number;
  categoria: string;
}

// ---- Erros de domínio: traduzem falhas de rede/HTTP para algo que o pedidos-service entende ----

export class ProdutoNaoEncontradoError extends Error {
  constructor(id: number) {
    super(`Produto ${id} não encontrado.`);
    this.name = "ProdutoNaoEncontradoError";
  }
}

export class EstoqueInsuficienteError extends Error {
  constructor(detalhe: string) {
    super(detalhe);
    this.name = "EstoqueInsuficienteError";
  }
}

export class ServicoIndisponivelError extends Error {
  constructor(servico: string) {
    super(`O serviço "${servico}" está indisponível no momento. Tente novamente em instantes.`);
    this.name = "ServicoIndisponivelError";
  }
}

/** Repassa o id de rastreio para que o mesmo valor apareça nos logs dos dois serviços. */
function cabecalhos(requestId: string) {
  return { "x-request-id": requestId };
}

/** Falha de rede (serviço fora do ar, timeout, DNS) ou resposta 5xx do outro lado. */
function ehIndisponibilidade(err: AxiosError): boolean {
  return !err.response || err.response.status >= 500;
}

/** GET /produtos/:id no produtos-service. */
export async function buscarProduto(id: number, requestId: string): Promise<ProdutoRemoto> {
  try {
    const resposta = await http.get<ProdutoRemoto>(`/produtos/${id}`, {
      headers: cabecalhos(requestId),
    });
    return resposta.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 404) throw new ProdutoNaoEncontradoError(id);
      if (ehIndisponibilidade(err)) throw new ServicoIndisponivelError("produtos-service");
    }
    throw err;
  }
}

/** POST /produtos/:id/estoque/baixa — reduz o estoque (dono do dado é o produtos-service). */
export async function baixarEstoque(
  id: number,
  quantidade: number,
  requestId: string,
): Promise<ProdutoRemoto> {
  try {
    const resposta = await http.post<ProdutoRemoto>(
      `/produtos/${id}/estoque/baixa`,
      { quantidade },
      { headers: cabecalhos(requestId) },
    );
    return resposta.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 404) throw new ProdutoNaoEncontradoError(id);
      if (err.response?.status === 409) {
        throw new EstoqueInsuficienteError(err.response.data?.erro ?? "Estoque insuficiente.");
      }
      if (ehIndisponibilidade(err)) throw new ServicoIndisponivelError("produtos-service");
    }
    throw err;
  }
}

/** POST /produtos/:id/estoque/devolucao — transação COMPENSATÓRIA (desfaz a baixa). */
export async function devolverEstoque(
  id: number,
  quantidade: number,
  requestId: string,
): Promise<void> {
  await http.post(
    `/produtos/${id}/estoque/devolucao`,
    { quantidade },
    { headers: cabecalhos(requestId) },
  );
}
