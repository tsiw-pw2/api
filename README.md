# API — Limpeza de Praias

Backend **REST** (Express + Sequelize + MySQL). Ponto de entrada: [`app.js`](app.js).

Guia completo para correr API + Web: [README na raiz](../README.md).

---

## Padrão académico (PW II)

| Área | Implementação |
| ---- | ------------- |
| Recursos | `/campaigns`, `/beaches`, `/users`, `/sessions`, … |
| Verbos | GET, POST, **PATCH** (parcial), DELETE |
| Erros | `{ success: false, message, errors, links? }` — 401 inclui `links.login`, 404 `links.index` |
| Listagens | `{ data, page?, pageSize?, total?, links }` com `next`/`prev`; `links.create` só se o actor pode criar |
| Recurso | JSON + `links` — `update`/`delete` **apenas** quando a acção é permitida (hypermedia estrito) |
| Índice | `GET /` — público: `sessions`, `users` (POST); autenticado: relações filtradas por papel (`roleHasCapability`) |
| Perfil | `GET|PATCH /users/me` (atalho); resposta com `links.self` → `/users/{id}` e `links.me` → `/users/me`; `PATCH /users/me/password`; `PATCH /users/me/avatar` (multipart) |
| Sessões | `POST /sessions`, `GET/PATCH|DELETE /sessions/current` (refresh em cookie `httpOnly`) |

Utils principais: `error.utils.js`, `response.utils.js`, `hypermedia.permissions.js`, `domain.utils.js`, `auth.js`.

**Vistas admin de utilizador:** `GET /users/:id/registrations` e `GET /users/:id/organized-campaigns` são coleções de leitura (`omitCreate` — sem `links.create` enganador). Cada item expõe a URI canónica em `/campaigns/...` (inscrição ou campanha). `GET /users/:id` inclui `links.registrations` e `links.organizedCampaigns`.

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

| Variável | Obrigatório | Notas |
| -------- | ----------- | ----- |
| `JWT_SECRET` | Sim | ≥ 32 caracteres |
| `REFRESH_TOKEN_SECRET` | Sim | ≥ 32 caracteres |
| `DB_USER` / `DB_PASSWORD` | Sim | Credenciais MySQL |
| `CLIENT_URL` | Sim | `http://localhost:5173` em dev |
| `CLOUDINARY_*` | Sim | Avatares de perfil |

### 3. Arrancar

```bash
pnpm run dev
```

### 4. Seed

```bash
pnpm run db:seed
```

Recria dados de demonstração (contas, catálogo, campanhas com vários estados, inscrições e comentários). Password: **`Demo2026!`**

Se o arranque falhar com `ER_TOO_MANY_KEYS` na tabela `utilizador`, corre primeiro `pnpm run db:fix-indexes` (índices UNIQUE duplicados de `sync({ alter: true })` antigo). O sync normal **não** usa `alter` — só activa `DB_SYNC_ALTER=1` quando mudares o schema dos modelos.

Se falhar com `organizacao_id doesn't exist` em `tipo_residuo` / `residuo` (catálogo scoped por org), corre:

```bash
pnpm run db:migrate-waste-org
```

Depois reinicia a API. Para dados demo completos (catálogo Póvoa, etc.): `pnpm run db:seed`.

### Contas de demonstração (4 papéis)

| Email | Papel | O que pode fazer |
| ----- | ----- | ---------------- |
| `gestao@mariva.pt` | **Root** (plataforma) | Campanhas (leitura); CRUD de organizações; **sem** praias, resíduos, inscrições nem categorias |
| `ambiente@viladoconde.pt` | **Admin da org** (CM Vila do Conde) | Dashboard, campanhas, praias, resíduos, categorias; tab **Equipa** |
| `ambiente@povoa.varzim.pt` | **Admin da org** (CM Póvoa) | Idem na Póvoa de Varzim |
| `operacoes@viladoconde.pt` | **Organizador** (sem admin org) | Campanhas e operações; **sem** tab Equipa |
| `maria.silva@email.pt` | **Voluntário** | Inscrições públicas; sem definições administrativas |

O papel **admin global** (`isAdmin`) deixou de conceder permissões — a autorização é por org (`isOrgAdmin`) ou root (`isRoot`).

---

## Endpoints (resumo)

Base: `http://127.0.0.1:3000`. Começa por **`GET /`**.

| Área | Rotas |
| ---- | ----- |
| Índice | `GET /` |
| Auth | `POST /sessions`, `GET/PATCH/DELETE /sessions/current` |
| Utilizadores | `POST /users`, `GET/PATCH /users/me`, `PATCH .../me/password`, `PATCH .../me/avatar` |
| Organizações | `GET/POST/PATCH /organizations` (root); membros em `/organizations/:id/members` (root ou admin da org) |
| Campanhas | `GET/POST /campaigns` + inscrições, comentários, recolhas |
| Catálogo | `/beaches`, `/waste-items`, `/waste-categories` |
| Dashboard | `GET /dashboards/overview` — staff municipal com contexto de org; `GET /` → `links.dashboards` |

Rotas protegidas: cabeçalho `Authorization: Bearer <token>`.

---

## Testes

```bash
pnpm test
```

Inclui `tests/integration/academic-contract.test.mjs` (índice com `links`, envelope de erro unificado).

Testes que exigem MySQL: correr com base configurada e, se necessário, `pnpm run db:seed` antes dos testes de integração completos.

```bash
pnpm run test:integration
```

---

## Exemplo de erro (handler global)

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": { "email": ["Invalid email"] }
}
```

## Exemplo de erro (middleware JWT)

```json
{
  "msg": "Token missing or invalid"
}
```
