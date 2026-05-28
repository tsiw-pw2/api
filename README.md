# API (Express + Sequelize + MySQL) — TSIW

Backend REST da aplicação **Limpeza de Praias**. Arranque único: [`app.js`](app.js).

Estrutura MVC flat: `controllers/`, `models/`, `routes/`, `middlewares/auth.middleware.js`, `utils/error.utils.js`.

## Requisitos

- Node.js 20+
- pnpm
- MySQL acessível com credenciais no `.env`

## Configuração

```bash
cd api
pnpm install
cp .env.example .env
```

| Variável | Notas |
| -------- | ----- |
| `JWT_SECRET` | Mínimo **32** caracteres |
| `REFRESH_TOKEN_SECRET` | Mínimo **32** caracteres (refresh em cookie httpOnly) |
| `JWT_EXPIRES_IN` | Validade do token (formato `jsonwebtoken`, ex.: `1d`, `15m`). Por defeito `15m` se omitido |
| `DB_*` | Ligação MySQL (`DB_NAME` por defeito: `limpeza_praias`) |
| `CLIENT_URL` | ex.: `http://localhost:5173` |
| `DB_DIALECT` | Por defeito `mysql` |
| `DB_SYNC_FORCE` | Opcional: `1` → `sync({ force: true })` (apaga e recria tabelas) |
| `DB_SYNC_ALTER` | Opcional: `1` → `sync({ alter: true })` (ajusta colunas ao modelo) |
| `DB_LOG_SQL` | Opcional: `1` imprime queries SQL na consola |
| `CLOUDINARY_CLOUD_NAME` | Cloud name da conta Cloudinary (avatares de perfil) |
| `CLOUDINARY_API_KEY` | API key Cloudinary |
| `CLOUDINARY_API_SECRET` | API secret Cloudinary (só no servidor) |
| `DEBUG_HTTP_ROUTES` | Em dev **ON** por defeito. `0` desliga; `1` força ON. Ex.: `[http] --> GET /campaigns` e `[http] <-- ... 200 12ms` |

## Base de dados

[`models/sequelize.js`](models/sequelize.js) cria a ligação; [`models/db.config.js`](models/db.config.js) importa os modelos, expõe `initDatabase()` (`authenticate` + `sync`) e re-exporta os modelos. As associações estão nos `*.model.js`.

Seed de desenvolvimento: `pnpm run db:seed` (limpa todas as tabelas da app e insere dados demo — ver `scripts/seed-database.mjs`). Sem seed, a BD fica vazia até `POST /users` ou inserção manual.

## Arranque

```bash
pnpm run dev
```

## Endpoints (raiz do servidor)

Respostas com **HATEOAS** (`data` + `links` nas listagens; recurso + `links` no detalhe/criação). Listagens paginadas incluem `page`, `pageSize`, `total` ao nível raiz. Ver [`utils/hateoas.utils.js`](utils/hateoas.utils.js) e [`utils/error.utils.js`](utils/error.utils.js).

- `POST /users` — criar utilizador (`201`); opcionalmente inclui `session` com `token` + cookie `refresh_token` (httpOnly)
- `POST /sessions` — criar sessão / login (`201`, `Location: /sessions/current`)
- `GET /sessions/current` — sessão actual (Bearer)
- `PATCH /sessions/current` — renovar access token (cookie refresh; rotação)
- `DELETE /sessions/current` — terminar sessão (`204`)
- `GET|PATCH /users/me`
- `GET /users` (admin), `PATCH /users/:id`
- CRUD `/beaches`, `/waste-items`, `/waste-categories`, `/campaigns` — **PUT** na actualização completa (raiz); **PATCH** em sub-recursos e perfil
- Sub-recursos sob `/campaigns/:campaignId/...`
- `GET /dashboard` — overview do dashboard (organizador/admin); inclui tendência mensal, top praias e impacto por tipo (ver [FEATURES-COSTA.md](../FEATURES-COSTA.md))
- `GET /campaigns` — listagem com filtros opcionais: `scope`, `status`, `district`, `from`, `to` (ver [FEATURES-COSTA.md](../FEATURES-COSTA.md))
- Avatares de perfil apenas em **Cloudinary** (`avatar_url` na BD = URL `https://res.cloudinary.com/...`).

## Testes

| Comando | Descrição |
| ------- | --------- |
| `pnpm test` | Unitários + integração (supertest; requer MySQL + `db:seed`) |
| `pnpm run test:unit` | Só unitários — sem MySQL |
| `pnpm run smoke:api` | Smoke com API já a correr (ver [`../TESTING.md`](../TESTING.md)) |

Listagens com filtros: `GET /waste-items?q=&category=&unit=` — ver [`../FEATURES-COSTA.md`](../FEATURES-COSTA.md).

## Frontend

Ver [web/README.md](../web/README.md) (proxy Vite para esta API).

## sequelize-cli

Não está nas dependências do projeto. Não é necessário instalar `sequelize-cli` para esta API.
