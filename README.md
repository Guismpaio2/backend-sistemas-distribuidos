# Backend — Gestão de Pedidos (microsserviços)

Três serviços Node.js + TypeScript + Express 5 do laboratório de **ECOS02A — Sistemas Distribuídos (UNIFEI)**.

| Serviço | Porta | Papel |
|---|---|---|
| `api-gateway` | 3000 | Porta de entrada (roteamento `/api/*`, CORS, `x-request-id`, `/health`) |
| `produtos-service` | 3001 | Catálogo e estoque |
| `pedidos-service` | 3002 | Pedidos; consulta o produtos-service via HTTP |

**Repositórios do projeto**

| Repositório | Conteúdo |
|---|---|
| [MicroService-SistemasDistribuidos](https://github.com/Guismpaio2/MicroService-SistemasDistribuidos) | Visão geral, `docker-compose.yml`, scripts de inicialização |
| **[backend-sistemas-distribuidos](https://github.com/Guismpaio2/backend-sistemas-distribuidos)** | **Este repositório** |
| [frontend-sistemas-distribuidos](https://github.com/Guismpaio2/frontend-sistemas-distribuidos) | Aplicação React |

> Diagrama, roteiro de demonstração e instruções do projeto completo: veja o readme do repositório [MicroService-SistemasDistribuidos](https://github.com/Guismpaio2/MicroService-SistemasDistribuidos).

---

## Como executar

Requer **Node.js ≥ 22.15**.

### 1. Instalar as dependências (uma vez)

```bash
npm install           # instala a raiz do backend
npm run install:all   # instala as dependências de cada serviço
```

### 2. Subir os serviços

Escolha **uma** das formas:

#### Tudo de uma vez (1 terminal) ✅ recomendado

```bash
npm run dev
```

Sobe `produtos-service`, `pedidos-service` e `api-gateway` no **mesmo terminal**, com recarga automática ao salvar arquivos e um log único e colorido (veja [Entendendo os logs](#entendendo-os-logs)). **Ctrl+C encerra os três.** Se um serviço falhar ao iniciar (por exemplo, porta ocupada), os outros também são encerrados.

#### Cada serviço em seu terminal (3 terminais)

Útil para ver o log de cada um isolado e para derrubar um serviço na demonstração:

```bash
# terminal 1
cd produtos-service && npm install && npm run dev
# terminal 2
cd pedidos-service  && npm install && npm run dev
# terminal 3
cd api-gateway      && npm install && npm run dev
```

#### Modo produção (código compilado)

```bash
npm run build         # compila os 3 serviços para dist/
npm start             # sobe os 3, usando o código compilado
```

### 3. Testar

```bash
npm run smoke         # teste do fluxo completo (com os serviços rodando)
curl localhost:3000/api/produtos
curl localhost:3000/health
```

> O **frontend** é outro repositório e roda em **outro terminal**: veja o README de [frontend-sistemas-distribuidos](https://github.com/Guismpaio2/frontend-sistemas-distribuidos).

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe os 3 serviços juntos (desenvolvimento, com recarga) |
| `npm start` | Sobe os 3 serviços juntos usando `dist/` (rode `build` antes) |
| `npm run build` | Compila os 3 serviços |
| `npm run typecheck` | Verifica os tipos dos 3 serviços |
| `npm run smoke` | Smoke test via gateway |
| `npm run install:all` | `npm install` dentro de cada serviço |

Em cada serviço: `npm run dev`, `build`, `start` e `typecheck` fazem o mesmo, só para aquele serviço.

---

## Configuração (variáveis de ambiente)

**Para `npm run dev` / `npm start` na raiz do backend** (os 3 juntos):

| Variável | Padrão | Efeito |
|---|---|---|
| `PORTA_PRODUTOS` | 3001 | Porta do produtos-service |
| `PORTA_PEDIDOS` | 3002 | Porta do pedidos-service |
| `PORTA_GATEWAY` | 3000 | Porta do api-gateway |

As URLs entre os serviços são ajustadas automaticamente. Exemplo, se 3000/3001 estiverem ocupadas:

```bash
PORTA_PRODUTOS=4001 PORTA_PEDIDOS=4002 PORTA_GATEWAY=4000 npm run dev
```

```powershell
$env:PORTA_PRODUTOS=4001; $env:PORTA_PEDIDOS=4002; $env:PORTA_GATEWAY=4000; npm run dev
```

(o frontend então precisa de `VITE_API_URL=http://localhost:4000/api`).

**Para cada serviço individualmente:**

| Serviço | Variável | Padrão |
|---|---|---|
| todos | `PORT` | 3000 / 3001 / 3002 |
| `pedidos-service` | `PRODUTOS_SERVICE_URL` | `http://localhost:3001` |
| `api-gateway` | `PRODUTOS_SERVICE_URL` | `http://localhost:3001` |
| `api-gateway` | `PEDIDOS_SERVICE_URL` | `http://localhost:3002` |
| `api-gateway` | `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` |

**Logs:**

| Variável | Efeito |
|---|---|
| `LOG_HEALTH=1` | Registra também as chamadas a `/health` (omitidas por padrão) |
| `NO_COLOR=1` | Desliga as cores |

---

## Entendendo os logs

Todos os serviços usam o mesmo formato, em colunas (`src/logger.ts` em cada serviço):

```
HORA      SERVIÇO   ID      MENSAGEM
16:27:43  produtos  ec70b7  GET    /produtos/2                 200     0ms
16:27:43  pedidos   ec70b7    ↳ chama produtos-service: GET /produtos/2 → 200 (9ms)
16:27:43  produtos  ec70b7  ✔ estoque do produto #2: 40 → 38
16:27:43  produtos  ec70b7  POST   /produtos/2/estoque/baixa   200     1ms
16:27:43  pedidos   ec70b7  ✔ pedido #1 criado: 2× Mouse Sem Fio Ergonômico (R$ 259,80)
16:27:43  pedidos   ec70b7  POST   /pedidos                    201    20ms
16:27:43  gateway   ec70b7  POST   /api/pedidos               → pedidos   201    29ms
```

- **ID de 6 caracteres:** é o `x-request-id`, gerado pelo gateway e repassado a todos os serviços. Todas as linhas com o mesmo id pertencem à **mesma requisição**. Para acompanhar uma compra, procure o id.
- **Ordem:** cada requisição é registrada **quando termina**, então a linha mais interna (produtos) vem primeiro e a mais externa (gateway) por último.
- **`↳ chama ...`:** chamada de um serviço a outro, com status e tempo (ou `falhou (ECONNREFUSED)` se o serviço estiver fora do ar).
- **`✔` sucesso · `⚠` aviso (ex.: serviço fora do ar, compensação de estoque) · `✖` erro.**
- **Cores:** nome do serviço (azul = produtos, magenta = pedidos, ciano = gateway); status verde (2xx), ciano (3xx), amarelo (4xx), vermelho (5xx); tempos ≥ 500 ms em amarelo.
- **`/health` fica de fora**, porque é consultado a cada poucos segundos pelo frontend e pelo gateway.

---

## Decisões de projeto

- **CORS só no gateway.** Serviços internos não falam com navegadores; configurar CORS neles seria redundante e ainda sobrescreveria a política do gateway.
- **ESM (`"type": "module"`).** Necessário para `http-proxy-middleware` v4. Imports relativos usam a extensão `.js`, mesmo em arquivos `.ts`.
- **Sem código compartilhado entre serviços.** Cada um é independente e implantável sozinho (o `logger.ts` é duplicado de propósito).
- **Erros de domínio → HTTP.** O pedidos-service traduz falhas do produtos-service em 404 (produto), 409 (estoque) e 503 (indisponível).
- **`scripts/dev.mjs` em vez de `concurrently`.** Os serviços herdam o terminal (logo, usam cores), sem prefixos duplicados nem banners do npm, e o `--clear-screen=false` impede o `tsx watch` de apagar o histórico a cada reinício.

## Convenção de commits

[Conventional Commits](https://www.conventionalcommits.org/pt-br/) com escopo por serviço: `feat(produtos-service): ...`, `fix(api-gateway): ...`, `build: ...`, `docs: ...`.
