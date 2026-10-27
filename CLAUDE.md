# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

FERSA CARE: a mobile-first after-sales portal (manuals, videos, catalogs, technical sheets, bulletins for FERSA bearings) with three access levels: visitor, logged-in client (`USUARIO`), and `ADMIN`. `backend/` (Express 5 + Drizzle + PostgreSQL) and `frontend/` (React 19 + Vite + TanStack Query) are **two independent npm packages**. There is no root workspace, so run `npm` inside each folder. The README (in Portuguese) has the full access matrix, demo logins, ER diagram and route table.

**Language convention:** all identifiers, comments, error messages, env var names and UI text are in Brazilian Portuguese (`criarDocumento`, `exigirAdmin`, `PORTA`, `JWT_SEGREDO`). Keep new code in Portuguese. The exception is the backend's layer folders and file suffixes, which are in English by the team's choice (`routes/`, `controllers/`, `documentos.service.ts`, `usuario.model.ts`); the names inside them stay Portuguese. Comments often compare things to Spring/Java (the team's background); keep that style when it helps.

## Commands

```bash
# Database (repo root). pgvector/pg17 image; also creates fersa_care_teste on first volume init
docker compose up -d db

# backend/
cp .env.example .env && npm install
npm run setup            # db:migrar + db:seed:exemplos (demo users/products/docs)
npm run dev              # tsx watch → http://localhost:3000, Swagger at /api/docs
npm test                 # vitest run (needs the DB running)
npx vitest run tests/auth.test.ts            # single file
npx vitest run tests/auth.test.ts -t "texto" # single test by name
npm run typecheck        # tsc --noEmit (includes tests/)
npm run db:gerar         # drizzle-kit generate after editing a model in src/models/
npm run db:migrar        # apply pending migrations

# frontend/
cp .env.example .env && npm install
npm run dev              # http://localhost:5173, proxies /api → :3000
npm run build            # tsc --noEmit && vite build

# Full app in one container (API also serves the built site) → http://localhost:3000
docker compose up --build
```

There is no linter or formatter configured, and the frontend has no tests.

### Test harness (backend)

- The tests run against a **real PostgreSQL** database, `fersa_care_teste`. Override it with `DATABASE_URL_TESTE`, either in the shell or in `backend/.env`, since `tests/ambiente.ts` loads it. `tests/ambiente.ts` refuses to run unless the DB name contains "test".
- `tests/preparar-banco.ts` (globalSetup) drops the `public` and `drizzle` schemas and re-applies all migrations once per run. `tests/setup.ts` runs `TRUNCATE` on an **explicit list of tables** before each test. **When you add a table, add it to that list.**
- Test files run serially (`fileParallelism: false`) because they share one DB.
- Build scenarios with `tests/ajudantes.ts`. It inserts directly into the DB (`criarUsuario`, `criarAdmin`, `criarDocumento({ visibilidade, publicado, liberadoPara, produtoIds })`, `criarProduto`), and `entrarComo(usuario)` returns a supertest agent that holds the session cookie.

## Backend architecture

- **ESM with `NodeNext`**: relative imports must end in `.js`, even from `.ts` files.
- `src/app.ts` `criarApp()` builds the Express app without listening, so tests can use it. `src/server.ts` checks the DB connection and that the tables exist, then listens.
- `src/config/env.ts` validates env vars with Zod **when it is imported** and calls `process.exit` if any is invalid. It loads `.env` via `process.loadEnvFile()`. If `JWT_SEGREDO` is unset outside production, it uses a random temporary secret, so sessions die on every restart.

### Request pipeline and auth

- `identificarUsuario` runs on every `/api` route. It reads the JWT from the `fersa_sessao` httpOnly cookie or `Authorization: Bearer`, then calls `authService.usuarioDaSessao`, which **loads the user from the DB on every request**. The token holds only the user id. Users who are not `ATIVO` are treated as visitors, so deactivating someone takes effect immediately.
- `exigirLogin` and `exigirAdmin` actually block requests. `src/routes/admin.routes.ts` applies `exigirAdmin` to everything under `/api/admin` and lists every admin endpoint in one place.
- Status semantics: **401** means log in, **403** means logged in but not admin, **404** means not found *or not allowed*. The API never reveals that a restricted document exists to someone who cannot see it. A visitor hitting a logged-in-only document gets 401 so the UI can prompt for login (see `buscarDocumentoVisivel` in `services/documentos.service.ts`).

### Single visibility rule (most important invariant)

`backend/src/repositories/visibilidade.ts` → `condicaoDeVisibilidade(usuario, { incluirRascunhos })` returns the Drizzle `WHERE` condition for which documents a caller may see. **Every repository query that returns documents must use it**: list, detail, download, counts, product pages, and the planned RAG retrieval. Services never build that condition; they pass the request's `usuario` to the repository (admin management passes the admin with `{ incluirRascunhos: true }`). Do not re-implement access checks elsewhere. `tests/acesso-documentos.test.ts` holds the full actor × visibility matrix; extend it when access behavior changes.

### Layers (`src/`)

A request flows **routes → controllers → services → repositories → models**. Each layer only calls the one below it. All of them are plain modules of exported functions (no classes), imported as namespaces (`import * as documentosRepository from ...`).

- `routes/*.routes.ts`: only map method + path + middlewares to a controller function. `routes/index.ts` mounts them under `/api` (plus `/api/saude`).
- `controllers/*.controller.ts`: parse input with the validators, call one service, then set status/cookies/headers. Handlers are `async` and simply `throw`; Express 5 forwards rejections to the error middleware.
- `services/*.service.ts`: business rules (permissions, admin-protection rules, file cleanup, password hashing), and they return DTOs. **Services never import `drizzle-orm`.** For transactions they use `emTransacao` from `db/index.ts` and pass `tx` into repository functions that take a `tx: Transacao` parameter. `documentos.service.ts` exports `listarPagina`, which the products and admin services reuse.
- `repositories/*.repository.ts`: every Drizzle query, returning raw rows (`{ linhas, total }` for pages). `atualizar()` functions set `atualizadoEm` themselves. Shared SQL helpers live in `repositories/sql.ts`.
- `models/`: one Drizzle table per `*.model.ts`, enums in `enums.ts`, and the row types (`Usuario`, `NovoUsuario`, `LinhaDocumento`, `UsuarioAutenticado`, …). `models/index.ts` re-exports everything and is what `drizzle.config.ts` and `db/index.ts` load. **A new table must be exported there**, or drizzle-kit won't see it.
- `validators/*.validator.ts`: Zod schemas plus their inferred input types, built from shared pieces in `src/lib/validacao.ts` (`esquemaPaginacao`, `esquemaParametroId`, `opcionalNaUrl`, `textoOpcional`, `campoEmail`, …).
- `dtos/*.dto.ts`: response shapes (`paraDocumentoDto`, `paraUsuarioDto`, which never exposes `senhaHash`).
- Paginated responses use `montarPagina()` → `{ itens, total, pagina, porPagina, totalPaginas }`.

### Errors

Throw the helpers in `src/lib/erros.ts` (`naoEncontrado`, `proibido`, `conflito`, `requisicaoInvalida`, or `new ErroHttp(...)`). `src/middlewares/erros.ts` turns every error into `{ erro: { codigo, mensagem, detalhes? } }`:

- `ZodError` → 400, with `detalhes: [{ campo, mensagem }]`. The frontend shows these under form fields.
- Postgres `23505` → 409, with a message chosen by constraint name from `MENSAGENS_DE_UNICIDADE`. Add an entry there when you add a unique constraint.

### Uploads

- Multipart forms send the file in a file field and all other fields as a JSON string in `dados`; `lerDadosDoFormulario(req)` handles both multipart and plain JSON.
- `middlewares/upload.ts` builds two uploaders with `criarUpload`: `uploadDeArquivo` (field `arquivo`, documents, any allowed type) and `uploadDeImagem` (field `imagem`, part photos, PNG/JPG/WebP only, max 5 MB). Each writes straight to `UPLOAD_DIR` under a random key and **deletes the file automatically if the response status is ≥ 400**.
- **Part photos** are public. The DTO exposes `imagemUrl` (`/api/produtos/:id/imagem?v=<atualizadoEm>`), never `imagemChave`. Active parts are served `public, immutable`; inactive parts' photos are visible only to admins. On update, a new photo replaces the old one, and `removerImagem: true` deletes it.
- When a file is replaced, the old file is removed only after the DB transaction commits.
- Storage is isolated in `src/lib/armazenamento.ts`, meant to be swappable for S3/SharePoint.

### Database and search

- Drizzle schema: `src/models/`. Migrations in `drizzle/` are versioned; generate them, don't hand-edit them. After a pure refactor of the models, `npm run db:gerar` should report "No schema changes". Exception: custom ones from `drizzle-kit generate --custom`.
- `0000_extensoes.sql` is hand-written. It creates `unaccent` plus an `IMMUTABLE` wrapper, `f_unaccent`, which the generated `documentos.busca` tsvector column depends on.
- **The DB must have pgvector.** `0002_pgvector.sql` (hand-written) runs `CREATE EXTENSION vector`, so migrations and tests fail on a plain PostgreSQL. Use the compose `db` service (`pgvector/pgvector:pg17`). If host port 5432 is taken, run `DB_PORTA=5433 docker compose up -d db` and point `DATABASE_URL`/`DATABASE_URL_TESTE` at that port.
- `documento_trechos` (`models/documento-trecho.model.ts`) is the RAG vector store: one row per text chunk, with an `embedding vector(1024)` (`DIMENSOES_DO_EMBEDDING`, bge-m3) and an HNSW cosine index, so query with `<=>`. Retrieval must join `documentos` and apply `condicaoDeVisibilidade`. Changing the embedding dimension needs a new migration plus a full re-index.
- Search combines Portuguese full-text search with `f_unaccent(...) ILIKE` (escape user input with `escaparLike`). Part codes are compared after stripping non-alphanumerics, so `32008X` matches "32008 X" (`somenteLetrasENumeros`).
- **Catalog model:** `categorias` (unique name, case-insensitive via a `lower(nome)` unique index) 1:N `produtos`. `produtos.categoria_id` is nullable with `ON DELETE SET NULL`, so deleting a category keeps its parts. Parts have numeric measures (`diametro_interno_mm`, `diametro_externo_mm`, `largura_mm`, `peso_kg`, `numeric` with `mode: 'number'`) and an optional `imagem_chave`. `/api/categorias` lists only categories that have active parts; the admin list shows all. Product search also matches the category name.
- **drizzle-kit can't prompt in this shell.** A model change that both drops and adds columns makes `generate` ask "renamed or new?" and fail with *Interactive prompts require a TTY*. Split it into two generates: additions first, then the drop (see `0004`/`0005`).
- `src/db/seed.ts` is idempotent. `--exemplos` or `SEED_EXEMPLOS=true` adds the fictitious demo data and the files in `seed/arquivos/`.

### API docs

`backend/openapi.yaml` is **hand-maintained** and served at `/api/docs`. Update it when you add or change routes.

## Frontend architecture

- **Same-origin setup:** in dev, Vite proxies `/api` to `:3000`. In production, the API serves `frontend/dist` (via `FRONTEND_DIST`) with an SPA fallback. Cookies therefore work without CORS; keep all API calls relative to `/api`.
- **API calls:** go through `api<T>()` in `src/api/cliente.ts`. It throws `ErroApi` (`status`, `codigo`, `erroDoCampo(campo)`). Calls are grouped in `api/portal.ts`, `api/auth.ts` and `api/admin.ts`.
- **Types:** `src/api/tipos.ts` **mirrors the backend DTOs by hand**. Change both together.
- **React Query** (`main.tsx`): any query that returns 401 invalidates the current-user query (`CHAVE_USUARIO_ATUAL` in `contexto/Autenticacao.tsx`). 4xx errors are not retried.
- **Routes** are in `App.tsx`. `RotaProtegida` guards `minha-conta` and `admin/*`. The admin area (`paginas/admin/`) is lazy-loaded so mobile clients don't download it.
- **Styling:** plain CSS files next to their components. Colors, typography and other tokens live only in `src/estilos/tokens.css`; other CSS should use those variables.
  - The look follows the FERSA website (brasil.fersa.com): white background, navy brand color `--marca` for primary actions/focus/active states, pill buttons and search (`--raio-pilula`), gray `--nevoa` panels, and Plus Jakarta Sans for everything.
  - Amber is reserved for "needs attention" (`--atencao*`: pending users, restricted docs). Don't use it as an action color.
  - Headings inherit their color, so text on navy bands is white automatically.
- **Mobile first:** a sticky white header, the global search bar below it, and a fixed bottom nav (`nav-inferior`) on phones. The catalog filters render twice: in the desktop sidebar and in a `<dialog className="gaveta">` bottom sheet on mobile. Radio `name`s use `useId()` so the two copies don't share a group.
- **Global search (`Layout.tsx`, `BuscaGlobal`)** is contextual. On `/produtos` and `/documentos` it writes `?busca=` on that page and keeps the other filters; elsewhere it goes to `/busca?q=`, which queries parts and documents in parallel. Pages listed in `SEM_BUSCA_GLOBAL` (home, `/busca`, auth, admin) don't show it.
- **Catalog UI:** `componentes/CartaoPeca.tsx` (part card plus `ImagemPeca`, which draws a bearing when there's no photo), `componentes/Trilha.tsx` (breadcrumb), `lib/medidas.ts` (pt-BR mm/kg formatting with the inch equivalent, and parsing of comma decimals typed in forms).
- **Logo:** `componentes/Marca.tsx` picks up `src/assets/marca/fersa.{svg,png,webp}` at build time via `import.meta.glob`; without it, it renders the name as text. Use FERSA's official file. Never redraw the logo.
- `tsconfig` has `noUnusedLocals`/`noUnusedParameters`, so unused imports break `npm run build`.

## Values duplicated between backend and frontend

Keep these in sync:

- Allowed upload extensions: `TIPOS_PERMITIDOS` in `backend/src/lib/armazenamento.ts` ↔ `EXTENSOES_ACEITAS` in `frontend/src/config.ts`.
- Upload size limit: `UPLOAD_LIMITE_MB` (API) ↔ `VITE_UPLOAD_LIMITE_MB` (site; baked in at build time, also a Dockerfile build arg).
- Part photos: `EXTENSOES_DE_IMAGEM` / `IMAGEM_LIMITE_MB` in `backend/src/lib/armazenamento.ts` ↔ `EXTENSOES` / `LIMITE_MB` in `frontend/src/paginas/admin/CampoImagem.tsx`.
- Part measure fields (`diametroInternoMm`, `diametroExternoMm`, `larguraMm`, `pesoKg`) and the catalog filter params (`internoMin`…`larguraMax`): `validators/produtos.validator.ts` ↔ `api/portal.ts`, `paginas/Produtos.tsx`, `paginas/admin/FormProduto.tsx`.
- Enums (`Perfil`, `Visibilidade`, `TipoDocumento`, `Segmento`, …): `pgEnum`s in `backend/src/models/enums.ts` ↔ `frontend/src/api/tipos.ts`.

## Planned work

Phase 2 is a RAG assistant (pgvector + Ollama). The plan is in `docs/RAG.md`. Its key constraint is that retrieval must filter with `condicaoDeVisibilidade`.
