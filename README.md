# API (Express + Sequelize + MySQL)

Backend REST da aplicação **Limpeza de Praias**. Prefixo dos endpoints: `/api/v1`.

## Requisitos

- [Node.js](https://nodejs.org/) 20+ (LTS recomendado)
- [pnpm](https://pnpm.io/)
- MySQL com o esquema aplicado (ver [stuff/database/README.md](../stuff/database/README.md))

## Configuração

```bash
cd api
pnpm install
cp .env.example .env
```

Preenche no `.env` (mínimo para arrancar):

| Variável | Notas |
|----------|--------|
| `JWT_SECRET` | Mínimo **32** caracteres aleatórios |
| `REFRESH_TOKEN_SECRET` | Mínimo **32** caracteres aleatórios |
| `DB_*` | Igual à instância MySQL (`DB_NAME=limpeza_praias` por defeito) |
| `ARGON_*` | Podes manter os valores do `.env.example` em desenvolvimento |
| `CLIENT_URL` | URL do frontend, ex.: `http://localhost:5173` |
| `SEED_USER_PASSWORD` | Opcional; palavra-passe única para contas demo após `db:seed` |

`PORT` por defeito: `3000`.

## Arranque

1. **Base de dados** — criar `limpeza_praias` e importar `stuff/database/limpeza_praias.sql` (instruções em [stuff/database/README.md](../stuff/database/README.md)).
2. **Ambiente** — `.env` preenchido como acima.
3. **Servidor:**

```bash
pnpm run dev
```

Modo sem watch: `pnpm start` ou `pnpm run start`.

Confirmação: mensagem `API listening on port 3000` (ou o teu `PORT`).

## Dados de demonstração (seed)

```bash
pnpm run db:seed
```

- **E-mail:** `admin@demo.local`
- **Palavra-passe:** `SEED_USER_PASSWORD` no `.env`, ou `SeedDemo2026!` se estiver vazio

Outras contas demo (`organizador1@demo.local`, `voluntario01@demo.local`, …) usam a mesma palavra-passe. O seed **trunca e repovoa** tabelas cobertas pelo script — não usar em dados que não possas perder.

Scripts adicionais: `pnpm run db:seed:edge`, `pnpm run db:seed:dense`, `pnpm run smoke:api`.

## Frontend

Com a API a correr, inicia o Vue em [web/README.md](../web/README.md) (`pnpm run dev` em `web/`).

## Ordem de arranque no monorepo

1. [Base de dados](../stuff/database/README.md)
2. **API** (esta pasta)
3. [Frontend](../web/README.md)

## Primeiro administrador sem seed

Insere manualmente um registo em `utilizador` com `palavra_passe` em **Argon2id** (parâmetros `ARGON_*` do `.env`). O campo deve guardar a string completa do hash (`$argon2id$…`). O servidor não cria utilizadores no arranque.

## Endpoints (v1)

Prefixo: `/api/v1`.

- `POST /auth/login` — cookie HttpOnly de refresh; JSON com `accessToken`.
- `POST /auth/refresh` — renova access token (cookie).
- `POST /auth/logout` — revoga refresh e limpa cookie.
- `GET /admin/users` — lista utilizadores (Bearer + admin).
- `PATCH /admin/users/:id/block` — corpo `{ "reason": "..." }`.
- `PATCH /admin/users/:id/unblock`.

**Praias** (`Authorization: Bearer` obrigatório)

- `GET /beaches` — lista.
- `POST /beaches` — corpo `{ name, municipality, district }` (`district`: código, ex. `braga`).
- `PATCH /beaches/:id` — atualizar (criador ou administrador).
- `DELETE /beaches/:id` — soft delete (criador ou administrador).

**Campanhas**

- `GET /campaigns` — lista (autenticado).
- `POST /campaigns` — criar (**organizador ou administrador**); corpo alinhado ao formulário web (`title`, `meetingTime`, `startDate`, `endDate`, `status`, `information`).
- `GET /campaigns/:id` — detalhe leve (resumo, praias, métricas, `viewerCanPostComment`; sem listas grandes).
- `PATCH /campaigns/:id` — atualizar (organizador da campanha ou administrador).
- `DELETE /campaigns/:id` — soft delete (mesma regra).
- `GET /campaigns/:campaignId/registrations?page&pageSize` — inscrições paginadas (autenticado).
- `POST /campaigns/:campaignId/registrations` — inscrever o próprio utilizador (voluntário, estado pendente).
- `GET /campaigns/:campaignId/waste-collections?page&pageSize&beachId?` — recolhas paginadas; `beachId` opcional filtra por praia da campanha.
- `GET /campaigns/:campaignId/comments?page&pageSize` — comentários paginados (visíveis; admin vê também ocultos).
- `POST /campaigns/:campaignId/comments` — publicar comentário (organizador, admin ou inscrito activo).

**Inscrições**

- `PATCH /registrations/:id` — organizador/admin altera função, estado, presença; o próprio utilizador só pode cancelar (`status` → `2`).
- `DELETE /registrations/:id` — organizador, administrador ou o próprio titular.

**Catálogo de resíduos** (`/waste`)

- `GET /waste` — lista ítens (`category` = código do formulário web; `tipo_residuo.nome` guarda esse código).
- `POST|PATCH|DELETE /waste` — **organizador ou administrador**.

**Comentários**

- `PATCH /comments/:id` — corpo `{ "isVisible": true|false }` (**admin**); visibilidade na moderação.

**Recolhas**

- `POST /campaigns/:campaignId/waste-collections` — corpo `{ beachId, wasteId, unitQuantity, actualWeightKg? }`; quem pode: organizador, administrador ou voluntário com inscrição **confirmada** na campanha; praia tem de estar associada à campanha.
- `PATCH /waste-collections/:id` — atualizar quantidades/peso.
- `DELETE /waste-collections/:id` — remover registo de recolha.

Respostas seguem `{ success, data?, message? }`.

## Alinhamento Programação Web II (TSIW)

A API segue a arquitetura MVC dos manuais da disciplina, com extensões para produção e segurança.

| Manual TSIW | Neste projeto |
|-------------|----------------|
| ES Modules (`import` / `export`, `"type": "module"`) | `api/package.json`, todos os ficheiros em `src/` |
| Entrada `index.js` / `node index.js` | `src/server.js` — `pnpm start` ou `pnpm run dev` |
| `/config`, `/controllers`, `/models`, `/routes`, `/middlewares`, `/utils` | `src/config/`, `src/api/v1/controllers/`, `src/models/`, `src/api/v1/routes/`, `src/middlewares/`, `src/utils/` |
| `express.json()` e `express.urlencoded({ extended: true })` | `src/app.js` |
| `sequelize` + credenciais em `process.env` | `src/config/sequelize.js` |
| Modelos e relações Sequelize | `src/models/*.model.js` (associações nos modelos; export em `models/index.js`) |
| JWT em `Authorization: Bearer` | `middlewares/authenticate.middleware.js` (equivalente a `verifyToken`) |
| Middlewares de autorização (`isAdmin`, …) | `require-admin.middleware.js`, `require-organizer.middleware.js` |
| Middleware de erros com 4 argumentos, no fim da app | `middlewares/error-handler.middleware.js` |
| Hash de palavra-passe | **Argon2id** (`argon2`), não `bcryptjs` — requisito de segurança do projeto |
| Camada extra `services/` | Regras de negócio entre controller e modelo (além do MVC dos slides) |

Para relatório ou oral: o fluxo pedido nos PDFs é **rota → controller → (opcional service) → modelo**; a autenticação usa access token em memória no cliente e refresh token em cookie HttpOnly (além do JWT básico dos exemplos).
