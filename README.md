# API (Express + Sequelize + MySQL)

## Arranque

1. Criar a base de dados e aplicar o schema base: `database/limpeza_praias.sql`.
2. Aplicar a migração de autenticação: `database/auth_refresh_tokens.sql` (adiciona `token_version` e a tabela `refresh_token`).
3. Se a tua `utilizador` for mais antiga e faltar coluna, aplicar `database/utilizador_avatar_url.sql` (adiciona `avatar_url`).
4. Se as tabelas forem mais antigas que o schema completo e faltar soft delete: `database/campaign_deleted_at.sql` (`campanha.deleted_at`), `database/campanha_praia_deleted_at.sql`, `database/praia_deleted_at.sql` — necessários para listagens N:N com Sequelize `paranoid`.
5. Aplicar `database/waste_unidade.sql` (coluna `unidade` em `residuo`).
6. Copiar `.env.example` para `.env` e preencher segredos (`JWT_SECRET`, `REFRESH_TOKEN_SECRET`, credenciais MySQL, Argon2).
7. Definir **`SEED_USER_PASSWORD`** no `.env` com a palavra-passe que queres usar em todos os testes locais (ex. `DevTest2026!`). Assim deixas de depender de valores “mágicos” espalhados: corres `pnpm run db:seed` e ficas sempre com a mesma combinação.
8. Na pasta `api/`: `pnpm install` e `pnpm run dev`.

## Administrador para testes (seed)

Depois de `pnpm run db:seed` na pasta `api/`:

- **E-mail:** `admin@demo.local`
- **Palavra-passe:** o valor de `SEED_USER_PASSWORD` no teu `.env`, ou `SeedDemo2026!` se `SEED_USER_PASSWORD` estiver vazio.

As outras contas de demonstração (`organizador1@demo.local` … `voluntario01@demo.local` …) partilham a mesma palavra-passe. O seed **trunca e repovoa** as tabelas cobertas pelo script — não uses isto em dados que não possas perder.

## Primeiro utilizador administrador

Insere manualmente um registo na tabela `utilizador` com `palavra_passe` em **Argon2id** usando os mesmos parâmetros `ARGON_*` que estão no `.env`. O campo tem de guardar a **string completa** do hash (começa por `$argon2id$`, dezenas de caracteres); valores curtos ou placeholders (ex. `001`) fazem o login falhar sempre.

O servidor não cria utilizadores automaticamente no arranque.

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
