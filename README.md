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
- MySQL 8.x (ou MariaDB compatível com `utf8mb4`)
- Base de dados vazia `limpeza_praias` (ver [_database/README.md](../_database/README.md))

### 2. Instalar e configurar

```bash
cd api
pnpm install
cp .env.example .env
```

Editar `.env` com os valores do ambiente. Variáveis obrigatórias:

| Variável | Notas |
| -------- | ----- |
| `JWT_SECRET` | ≥ 32 caracteres |
| `REFRESH_TOKEN_SECRET` | ≥ 32 caracteres |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Ligação MySQL |
| `CLIENT_URL` | URL do frontend (ex.: `http://localhost:5173`) — usada no CORS |
| `CLOUDINARY_*` | Avatares de perfil (`PATCH /users/me/avatar`) |
| `SEED_DEFAULT_PASSWORD` | Password das contas demo (por defeito `Demo2026!`) |

Criar a base de dados (se ainda não existir):

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS limpeza_praias CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 3. Arrancar a API

```bash
pnpm run dev
```

No primeiro arranque, o Sequelize cria as tabelas automaticamente (`sequelize.sync()` em `models/db.config.js`). A API fica disponível em:

| Ambiente | URL da API |
| -------- | ---------- |
| Desenvolvimento local | `http://127.0.0.1:3000` (porta definida em `PORT`, por defeito 3000) |

O servidor escuta em `127.0.0.1` — acessível apenas na máquina local. Para expor noutro host, usar reverse proxy (nginx, etc.) ou alterar o `listen` em `app.js`.

Verificar que a API responde:

```bash
curl -s http://127.0.0.1:3000/ | head
```

### 4. Dados de demonstração (seed)

A API **não** insere dados automaticamente. Depois do primeiro arranque (tabelas criadas), correr:

```bash
pnpm run db:seed
```

Este comando apaga todos os dados das tabelas da aplicação e repõe um conjunto de **pitch** credível: ~22 utilizadores, 6 praias, 9 resíduos, 7 campanhas (todos os estados), ~40 inscrições, 10 comentários (só na campanha concluída) e ~18 recolhas com datas históricas para o dashboard.

**Roteiro rápido de demo:**

1. Homepage (sem login) — mapa com campanhas activas
2. `voluntario2@demo.pt` — inscrição em «Limpeza de Verão — Espinho»
3. `organizador@demo.pt` — campanha em curso (recolhas) + dashboard
4. «Limpeza de Primavera — Vila do Conde» — comentários e impacto histórico
5. `admin@demo.pt` — utilizadores e categorias de resíduos

**Nota:** a variável correcta no `.env` é `SEED_DEFAULT_PASSWORD` (não `SEED_USER_PASSWORD`).

Em `NODE_ENV=production`, o seed só corre se `SEED_ALLOW=1` estiver definido.

---

## Backup e restauro da base de dados

Para recriar o sistema noutro servidor (esquema + dados), existem duas abordagens complementares.

### Opção A — Dump MySQL (recomendado para migração)

Exportar a base completa (estrutura e dados):

```bash
mysqldump -u root -p \
  --single-transaction \
  --routines \
  --triggers \
  --default-character-set=utf8mb4 \
  limpeza_praias > limpeza_praias_backup.sql
```

Restaurar noutro servidor:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS limpeza_praias CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p limpeza_praias < limpeza_praias_backup.sql
```

Depois do restauro, configurar o `.env` no novo servidor e arrancar a API (`pnpm run dev` ou `pnpm start`). **Não** é necessário correr o seed se o dump incluir todos os dados.

### Opção B — Esquema via API + seed (recriação a partir do código)

Útil quando não há dump disponível:

1. Criar base vazia `limpeza_praias`
2. Configurar `.env` e correr `pnpm run dev` (cria tabelas via `sync`)
3. Correr `pnpm run db:seed` (repõe dados de demonstração)

### Tabelas de referência (lookup)

O dump inclui automaticamente as tabelas de catálogo/referência:

| Tabela | Conteúdo |
| ------ | -------- |
| `tipo_residuo` | Categorias de resíduo (Plástico, Vidro, Metal, …) |
| `residuo` | Itens do catálogo (Garrafa PET, Lata de alumínio, …) |
| `localizacao_praia` | Distritos, concelhos e freguesias partilhados por praias |

Estas tabelas são também repostas pelo `db:seed`. As restantes tabelas (`utilizador`, `praia`, `campanha`, `inscricao`, `comentario`, `recolha_residuo`, `campanha_praia`, `refresh_token`) contêm dados operacionais e de sessão.

### Backup apenas de dados de referência

Se precisares de exportar só o catálogo (sem campanhas nem utilizadores):

```bash
mysqldump -u root -p limpeza_praias \
  tipo_residuo residuo localizacao_praia \
  > limpeza_praias_lookup.sql
```

---

## Acesso ao sistema

### Endereços

| Serviço | URL (desenvolvimento) | Notas |
| ------- | --------------------- | ----- |
| API REST | `http://127.0.0.1:3000` | Índice: `GET /` |
| Frontend | valor de `CLIENT_URL` no `.env` | Por defeito `http://localhost:5173` |

Autenticação nas rotas protegidas: cabeçalho `Authorization: Bearer <token>` (obtido via `POST /sessions`).

### Contas de demonstração (após `pnpm run db:seed`)

Password comum (excepto conta bloqueada): valor de `SEED_DEFAULT_PASSWORD` no `.env`, ou **`Demo2026!`** por defeito.

| Email | Perfil | Notas |
| ----- | ------ | ----- |
| `admin@demo.pt` | Administrador | Gestão de utilizadores, categorias de resíduo, dashboard |
| `organizador@demo.pt` | Organizador (Matosinhos) | Campanhas, praias, recolhas, dashboard |
| `organizador2@demo.pt` | Organizador (Espinho) | Campanha aberta a inscrições |
| `voluntario1@demo.pt` | Voluntário | Já inscrita em «Limpeza de Verão — Espinho» |
| `voluntario2@demo.pt` | Voluntário | Pode auto-inscrever-se na campanha Espinho |
| `voluntario3@demo.pt` … `voluntario15@demo.pt` | Voluntário | Contas extra (nomes portugueses) |
| `bloqueado@demo.pt` | — | Conta bloqueada (login recusado com 403) |

Comentários de campanha só ficam disponíveis **após conclusão** (estado «concluída»). Para demo de comentários, usar a campanha «Limpeza de Primavera — Vila do Conde».

Login via API:

```bash
curl -s -X POST http://127.0.0.1:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{"email":"organizador@demo.pt","password":"Demo2026!"}'
```

### Credenciais de infraestrutura

| Componente | Onde configurar | Exemplo (dev) |
| ---------- | --------------- | ------------- |
| MySQL | `.env` → `DB_USER`, `DB_PASSWORD` | `root` / (definido localmente) |
| JWT | `.env` → `JWT_SECRET`, `REFRESH_TOKEN_SECRET` | Segredos ≥ 32 caracteres |
| Cloudinary | `.env` → `CLOUDINARY_*` | Necessário para upload de avatares |

**Nunca commitar o ficheiro `.env`** — usar `.env.example` como modelo.

---

## Endpoints (resumo)

Base: `http://127.0.0.1:3000`. Começa por **`GET /`**.

| Área | Rotas |
| ---- | ----- |
| Índice | `GET /` |
| Auth | `POST /sessions`, `GET/PATCH/DELETE /sessions/current` |
| Utilizadores | `POST /users`, `GET/PATCH /users/me`, `PATCH .../me/password`, `PATCH .../me/avatar`, admin em `GET/PATCH /users/:id` |
| Campanhas | `GET/POST /campaigns` + inscrições, comentários, recolhas |
| Catálogo | `/beaches`, `/waste-items`, `/waste-categories` |
| Dashboard | `GET /dashboards/overview` (singleton; alias `GET /dashboards`) — organizador/admin; `GET /` → `links.dashboards` |

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
