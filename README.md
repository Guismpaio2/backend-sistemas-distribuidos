# Backend — Gestão de Pedidos (microsserviços)

Três serviços Node.js + TypeScript + Express 5 do laboratório de **ECOS02A — Sistemas Distribuídos (UNIFEI)**.

| Serviço | Porta | Papel |
|---|---|---|
| `api-gateway` | 3000 | Porta de entrada (roteamento `/api/*`, CORS, `x-request-id`, `/health`) |
| `produtos-service` | 3001 | Catálogo e estoque |
| `pedidos-service` | 3002 | Pedidos; consulta o produtos-service via HTTP |

> Visão geral, diagrama e roteiro de demonstração: veja o `readme.md` da pasta `Laboratorio/`.

## Executando

Requer **Node.js ≥ 22.15**.

```bash
npm install           # instala o concurrently (raiz)
npm run install:all   # instala as dependências de cada serviço
npm run dev           # sobe os 3 serviços juntos, com logs coloridos
npm run smoke         # teste de fumaça (com os serviços rodando)
```

Ou, individualmente: `cd produtos-service && npm install && npm run dev` (idem para os outros).

## Configuração (variáveis de ambiente)

| Serviço | Variável | Padrão |
|---|---|---|
| todos | `PORT` | 3000 / 3001 / 3002 |
| `pedidos-service` | `PRODUTOS_SERVICE_URL` | `http://localhost:3001` |
| `api-gateway` | `PRODUTOS_SERVICE_URL` | `http://localhost:3001` |
| `api-gateway` | `PEDIDOS_SERVICE_URL` | `http://localhost:3002` |
| `api-gateway` | `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` |

## Decisões de projeto

- **CORS só no gateway.** Serviços internos não falam com navegadores; configurar CORS neles seria redundante e ainda sobrescreveria a política do gateway.
- **ESM (`"type": "module"`).** Necessário para `http-proxy-middleware` v4. Imports relativos usam a extensão `.js`, mesmo em arquivos `.ts`.
- **Sem código compartilhado entre serviços.** Cada um é independente e implantável sozinho.
- **Erros de domínio → HTTP.** O pedidos-service traduz falhas do produtos-service em 404 (produto), 409 (estoque) e 503 (indisponível).

## Convenção de commits

[Conventional Commits](https://www.conventionalcommits.org/pt-br/) com escopo por serviço: `feat(produtos-service): ...`, `fix(api-gateway): ...`, `build: ...`, `docs: ...`.
