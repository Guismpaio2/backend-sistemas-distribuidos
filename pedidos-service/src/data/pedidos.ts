/**
 * "Banco de dados" do pedidos-service (array em memória).
 *
 * Repare que o pedido guarda uma CÓPIA do nome e do preço do produto no
 * momento da compra (`nomeProduto`, `precoUnitario`). Em microsserviços isso é
 * normal e desejável: se o preço mudar depois no produtos-service, o pedido
 * antigo continua com o valor que o cliente realmente pagou. Também evita
 * precisar consultar outro serviço só para exibir um pedido antigo.
 */

export type StatusPedido = "CONFIRMADO" | "CANCELADO";

export interface Pedido {
  id: number;
  productId: number;
  nomeProduto: string;
  quantidade: number;
  precoUnitario: number;
  total: number;
  status: StatusPedido;
  criadoEm: string; // ISO 8601
}

export const pedidos: Pedido[] = [];

let proximoId = 1;

export function criarPedido(dados: Omit<Pedido, "id" | "criadoEm">): Pedido {
  const pedido: Pedido = {
    id: proximoId++,
    criadoEm: new Date().toISOString(),
    ...dados,
  };
  pedidos.push(pedido);
  return pedido;
}

export function buscarPedido(id: number): Pedido | undefined {
  return pedidos.find((p) => p.id === id);
}
