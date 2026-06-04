# API — Limpeza de Praias

Backend **REST** (Express + Sequelize + MySQL). Ponto de entrada: [`app.js`](app.js).

Guia completo para correr API + Web: [README na raiz](../README.md).

---

## Conformidade REST

| Princípio | Implementação |
| --------- | ------------- |
| Recursos (substantivos) | `/campaigns`, `/beaches`, `/users`, `/sessions`, … |
| Verbos HTTP | GET (ler), POST (criar), **PATCH** (atualizar parcial), DELETE (remover) |
| Códigos HTTP | 200, 201 + `Location`, 204, 400, 401, 403, 404, 406, 415, 409, 429, 5xx |
| HATEOAS | Respostas com `_links` (`href`, `method`, `rel`); cliente descobre acções sem URLs fixas |
| Descoberta | `GET /` devolve índice (`create-session`, `campaigns`, `me`, `refresh-session`, …) |
| Paginação | `limit`, `offset` (+ alias `page`/`pageSize`); links `first` / `prev` / `next` / `last` |
| Erros | `description` (+ `errors` para validação), como no exemplo da disciplina; `_links.api` → `GET /` |
| OPTIONS | `Allow` por coleção/recurso (ex. `OPTIONS /beaches`) |
| Conteúdo | `Accept: application/json`; corpo JSON em POST/PATCH (exceto avatar multipart) |
| Auth | `POST /sessions` (login), `PATCH /sessions/current` (refresh cookie), Bearer JWT |
| Registo | `POST /users` (201) → `POST /sessions` (201); sem `POST /users/login` (verbos no URL) |

**Nota:** Não se usa `POST /users/login` (material AUTHENTICATION.pdf) para respeitar as regras de URI do RESTAPI.pdf. O refresh token usa cookie `httpOnly` no sub-recurso `PATCH /sessions/current`.

---

## Como correr

### 1. Pré-requisitos

- Node.js 20+
- pnpm
- MySQL com a base `limpeza_praias` criada (ver [database/README.md](../database/README.md))

### 2. Instalar e configurar

```bash
cd api
pnpm install
cp .env.example .env
```

Preenche no `.env`:

| Variável | Obrigatório | Notas |
| -------- | ----------- | ----- |
| `JWT_SECRET` | Sim | ≥ 32 caracteres |
| `REFRESH_TOKEN_SECRET` | Sim | ≥ 32 caracteres |
| `DB_USER` / `DB_PASSWORD` | Sim | Credenciais MySQL |
| `CLIENT_URL` | Sim | `http://localhost:5173` em dev |
| `CLOUDINARY_*` | Sim | Avatares de perfil |
| `JWT_EXPIRES_IN` | Não | Ex.: `1d`, `15m` |
| `DB_SYNC_FORCE` | Não | `1` apaga e recria tabelas (**só dev**) |
| `DB_SYNC_ALTER` | Não | `1` ajusta colunas ao modelo |
| `DB_LOG_SQL` | Não | `1` imprime SQL na consola |
| `DEBUG_HTTP_ROUTES` | Não | Em dev ON por defeito; `0` desliga |

### 3. Arrancar

```bash
pnpm run dev
```

Mensagens esperadas: ligação MySQL OK, modelos sincronizados, `API listening on http://127.0.0.1:3000`.

### 4. Seed (dados demo)

```bash
pnpm run db:seed
```

Password: **`Demo2026!`** (ou `SEED_DEFAULT_PASSWORD` no `.env`).

---

## Frontend

Com a API a correr, abre noutro terminal:

```bash
cd ../web
pnpm install
cp .env.example .env
pnpm run dev
```

Ver [web/README.md](../web/README.md).

---

## Endpoints (resumo)

Base: `http://127.0.0.1:3000`. Começa por **`GET /`** para o mapa HATEOAS.

| Área | Rotas |
| ---- | ----- |
| Índice | `GET /` |
| Auth | `POST /sessions`, `GET/PATCH/DELETE /sessions/current` |
| Utilizadores | `POST /users`, `GET/PATCH /users/me`, `GET/PATCH /users/:id` (admin) |
| Campanhas | `GET/POST /campaigns`, sub-recursos inscrições/comentários/recolhas |
| Catálogo | `/beaches`, `/waste-items`, `/waste-categories` |
| Dashboard | `GET /dashboard` (organizador/admin) |

Atualizações de recursos: **PATCH** (não PUT). Ver [`utils/hateoas.utils.js`](utils/hateoas.utils.js).

Avatares: upload via `PATCH /users/me` → guardados na **Cloudinary**.

---

## Testes

```bash
pnpm run db:seed && pnpm test          # integração + unitários
pnpm run test:unit                     # só unitários (sem MySQL)
pnpm run smoke:api                     # smoke com API já a correr
```
