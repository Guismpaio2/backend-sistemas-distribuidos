#!/usr/bin/env bash
# Smoke test do backend: exercita o fluxo completo passando SEMPRE pelo api-gateway.
#
# Uso:
#   ./scripts/smoke-test.sh                       # usa http://localhost:3000
#   ./scripts/smoke-test.sh http://localhost:4000 # gateway em outra porta
#   FRONTEND_ORIGIN=http://localhost:4173 ./scripts/smoke-test.sh   # frontend em outra porta
#
# Pré-requisito: os 3 serviços já estão rodando (veja o readme).

set -u
GATEWAY="${1:-http://localhost:3000}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-http://localhost:5173}"
FALHAS=0

# verifica CODIGO_ESPERADO DESCRIÇÃO [args do curl...]
verifica() {
  local esperado="$1" descricao="$2"
  shift 2
  local corpo codigo
  corpo=$(curl -s -o /dev/stdout -w '\n%{http_code}' "$@")
  codigo=$(printf '%s' "$corpo" | tail -n1)
  corpo=$(printf '%s' "$corpo" | sed '$d')
  if [ "$codigo" = "$esperado" ]; then
    printf '  \033[32mOK\033[0m   [%s] %s\n' "$codigo" "$descricao"
  else
    printf '  \033[31mFALHOU\033[0m [%s, esperado %s] %s\n         %s\n' "$codigo" "$esperado" "$descricao" "$corpo"
    FALHAS=$((FALHAS + 1))
  fi
}

JSON=(-H 'content-type: application/json')

echo "Gateway: $GATEWAY"
echo
echo "Roteamento e leitura"
verifica 200 "GET  /health (gateway + dependências)"       "$GATEWAY/health"
verifica 200 "GET  /api/produtos"                          "$GATEWAY/api/produtos"
verifica 200 "GET  /api/produtos/1"                        "$GATEWAY/api/produtos/1"
verifica 404 "GET  /api/produtos/999 (inexistente)"        "$GATEWAY/api/produtos/999"
verifica 200 "GET  /api/pedidos"                           "$GATEWAY/api/pedidos"
verifica 404 "GET  /rota-que-nao-existe"                   "$GATEWAY/rota-que-nao-existe"

echo
echo "Criação de pedido (comunicação pedidos-service -> produtos-service)"
verifica 201 "POST /api/pedidos (productId=2, quantidade=1)" "${JSON[@]}" -X POST -d '{"productId":2,"quantidade":1}' "$GATEWAY/api/pedidos"
verifica 404 "POST /api/pedidos com produto inexistente"     "${JSON[@]}" -X POST -d '{"productId":999,"quantidade":1}' "$GATEWAY/api/pedidos"
verifica 409 "POST /api/pedidos acima do estoque"            "${JSON[@]}" -X POST -d '{"productId":2,"quantidade":100000}' "$GATEWAY/api/pedidos"
verifica 400 "POST /api/pedidos com corpo inválido"          "${JSON[@]}" -X POST -d '{"productId":"abc","quantidade":0}' "$GATEWAY/api/pedidos"

echo
echo "CORS (apenas no gateway)"
PERMITIDA=$(curl -s -i "$GATEWAY/api/produtos" -H "Origin: $FRONTEND_ORIGIN" | tr -d '\r' | grep -i '^access-control-allow-origin:' || true)
BLOQUEADA=$(curl -s -i "$GATEWAY/api/produtos" -H 'Origin: http://site-malicioso.example' | tr -d '\r' | grep -i '^access-control-allow-origin:' || true)
if [ -n "$PERMITIDA" ]; then printf '  \033[32mOK\033[0m   origem do frontend permitida (%s)\n' "$PERMITIDA"; else printf '  \033[31mFALHOU\033[0m origem do frontend deveria ser permitida\n'; FALHAS=$((FALHAS + 1)); fi
if [ -z "$BLOQUEADA" ]; then printf '  \033[32mOK\033[0m   origem desconhecida não recebe Access-Control-Allow-Origin\n'; else printf '  \033[31mFALHOU\033[0m origem desconhecida recebeu: %s\n' "$BLOQUEADA"; FALHAS=$((FALHAS + 1)); fi

echo
if [ "$FALHAS" -eq 0 ]; then
  printf '\033[32mTodos os testes passaram.\033[0m\n'
else
  printf '\033[31m%s teste(s) falharam.\033[0m\n' "$FALHAS"
  exit 1
fi
