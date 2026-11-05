/**
 * "Banco de dados" do produtos-service.
 *
 * Em um sistema real isto seria um PostgreSQL/MongoDB exclusivo deste serviço.
 * Aqui usamos um array em memória. O ponto importante da arquitetura de
 * microsserviços é o seguinte: ESTES DADOS PERTENCEM SOMENTE a este serviço.
 * Nenhum outro serviço lê este array diretamente; só pode pedir via API HTTP.
 */

export interface Produto {
  id: number;
  nome: string;
  preco: number; // em reais (BRL)
  estoque: number; // unidades disponíveis
  categoria: string;
}

export const produtos: Produto[] = [
  { id: 1, nome: "Notebook Ultrafino 14\"", preco: 4599.9, estoque: 8, categoria: "Informática" },
  { id: 2, nome: "Mouse Sem Fio Ergonômico", preco: 129.9, estoque: 40, categoria: "Periféricos" },
  { id: 3, nome: "Teclado Mecânico ABNT2", preco: 349.0, estoque: 25, categoria: "Periféricos" },
  { id: 4, nome: "Monitor 27\" 4K", preco: 2199.0, estoque: 6, categoria: "Informática" },
  { id: 5, nome: "Headset com Cancelamento de Ruído", preco: 599.5, estoque: 15, categoria: "Áudio" },
  { id: 6, nome: "Webcam Full HD", preco: 259.9, estoque: 0, categoria: "Periféricos" },
];

export function buscarPorId(id: number): Produto | undefined {
  return produtos.find((p) => p.id === id);
}
