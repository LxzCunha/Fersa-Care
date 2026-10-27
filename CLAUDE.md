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
npm test                 # vitest run: both projects below (integration needs the DB running)
npm run test:unidade     # pure unit tests (tests/unidade/), no DB, ~1s
npm run test:integracao  # API + real PostgreSQL (tests/*.test.ts)
npx vitest run tests/auth.test.ts            # single file
npx vitest run tests/auth.test.ts -t "texto" # single test by name
npm run typecheck        # tsc --noEmit (includes tests/)
npm run db:gerar         # drizzle-kit generate after editing a model in src/models/
npm run db:migrar        # apply pending migrations
npm run capas:gerar      # generate missing document covers (idempotent; the Docker image runs it on start)
npm run ia:indexar       # index pending documents for the assistant (-- --todos to redo all); needs Ollama
# Ollama (once): ollama pull bge-m3 && ollama pull qwen2.5:14b

# frontend/
cp .env.example .env && npm install
npm run dev              # http://localhost:5173, proxies /api → :3000
npm run build            # tsc --noEmit && vite build (also typechecks tests/)
npm test                 # vitest + jsdom + Testing Library, API mocked; no backend needed
npx vitest run tests/admin/produtos.test.tsx -t "texto"   # single file / test

# Full app in one container (API also serves the built site) → http://localhost:3000
docker compose up --build
```

There is no linter or formatter configured. `docs/` is **gitignored** (local working notes: the original RAG plan and a manual QA script, `docs/roteiro-de-testes-manuais.md`, with case codes like D6); don't link to it from versioned files.

### Test harness (backend)

- The tests run against a **real PostgreSQL** database, `fersa_care_teste`. Override it with `DATABASE_URL_TESTE`, either in the shell or in `backend/.env`, since `tests/ambiente.ts` loads it. `tests/ambiente.ts` refuses to run unless the DB name contains "test".
- `tests/preparar-banco.ts` (globalSetup) drops the `public` and `drizzle` schemas and re-applies all migrations once per run. `tests/setup.ts` runs `TRUNCATE` on an **explicit list of tables** before each test. **When you add a table, add it to that list.**
- `vitest.config.ts` has two projects: **`unidade`** (`tests/unidade/**`: validators, DTOs, `lib/` helpers, the error middleware; no globalSetup, no DB) and **`integracao`** (`tests/*.test.ts`, with the DB setup below). Pure logic goes in `unidade`; anything through HTTP goes in `integracao` (the `crud-*.test.ts` files cover CRUD field by field, 404/400/409 and public display).
- Test files run serially (`fileParallelism: false`) because they share one DB.
- Build scenarios with `tests/ajudantes.ts`. It inserts directly into the DB (`criarUsuario`, `criarAdmin`, `criarDocumento({ visibilidade, publicado, liberadoPara, produtoIds })`, `criarProduto`), and `entrarComo(usuario)` returns a supertest agent that holds the session cookie.

### Test harness (frontend)

- Tests live in `frontend/tests/` (`unidade/` for `lib/`, `componentes/` for display components and the admin building blocks, `admin/` for each CRUD screen, `portal/` for catalog and library pages). jsdom + Testing Library + user-event; `TZ` is fixed to `America/Sao_Paulo`.
- The API is never called: each file mocks the API module (`vi.mock('../../src/api/admin')` or `'../../src/api/portal'`) and sets results with `vi.mocked(api.x).mockResolvedValue(...)`. `mockReset` runs between tests.
- `tests/renderizar.tsx`: `renderizar(rotas | elemento, { caminho, usuario })` renders with React Query, auth (user pre-set, no fetch), notifications and a memory router; it returns `pessoa` (user-event) and `endereco()` (current path + query). For admin windows, `await esperarJanela('Peça')` waits for the loaded form (the loading window has the same title but no "Salvar").
- `tests/fabricas.ts` builds API-shaped data (`umProduto`, `umDocumento`, `umaPagina`…). `tests/preparar.ts` polyfills `<dialog>`, `matchMedia`, `URL.createObjectURL` and scrolling for jsdom.

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
- `middlewares/upload.ts` builds the uploaders with `criarUpload([...campos])` (at most one file per field, each with its own extensions and size limit): `uploadDeDocumento` (field `arquivo`, any allowed type, plus optional `capa`, image only, max 5 MB) and `uploadDeImagem` (field `imagem`, part photos, PNG/JPG/WebP only, max 5 MB). Controllers read files with `arquivoEnviado(req, 'campo')`, not `req.file`. Files are written straight to `UPLOAD_DIR` under a random key and **deleted automatically if the response status is ≥ 400**. Upload errors carry `detalhes: [{ campo }]`, so the form shows them under the right field.
- **Part photos** are public. The DTO exposes `imagemUrl` (`/api/produtos/:id/imagem?v=<atualizadoEm>`), never `imagemChave`. Active parts are served `public, immutable`; inactive parts' photos are visible only to admins. On update, a new photo replaces the old one, and `removerImagem: true` deletes it.
- **Document covers** (`documentos.capa_chave`, `capa_personalizada`): `src/lib/capas.ts` renders a 480 px WebP from page 1 of a PDF (pdf.js `legacy` build + `@napi-rs/canvas`, imported lazily) or from an image document. Other formats (video, Office, links) have no automatic cover; the site draws one with the type icon. An admin-uploaded cover (field `capa`) is stored only as the reduced WebP and survives file replacements until `removerCapa: true`; the rules are in `definirCapa` (`documentos-admin.service.ts`). Failing to render an automatic cover never blocks saving. The DTO exposes `capaUrl` (`/api/documentos/:id/capa?v=<atualizadoEm>`), never the key; that endpoint goes through `buscarDocumentoVisivel`, so it has the same 401/404 rules as the document. `npm run capas:gerar` (`gerarCapasPendentes`) backfills documents without a cover and does not touch `atualizadoEm`.
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
- **Admin shell:** `/admin/*` is routed **outside** the portal `Layout` (no portal header, footer or bottom nav). `paginas/admin/LayoutAdmin.tsx` draws its own shell: a dark navy sidebar (`--lateral-*` tokens) with grouped, collapsible entries, Expand/Collapse all, a page search (Enter opens the first match), "Sair" at the bottom, and a white top bar with the breadcrumb and an account menu. On desktop the sidebar collapses to an icon rail (remembered in `localStorage`); on phones it is a drawer (focus moves in, Esc closes it, the content becomes `inert`). Menu entries live in `PAINEL`/`GRUPOS` there; `paginaAtual()` picks the most specific entry (e.g. `/admin/produtos/novo` → "Cadastrar peça", `?status=PENDENTE` → "Aguardando aprovação"). Add new admin pages to that list.
- **Admin registration screens** (`paginas/admin/Cadastro.tsx`), in a minimalist back-office style:
  - Lists use `CabecalhoLista` (title + "+"), `Abas` (segmented filter bar), `BarraBusca` with `FiltroNaBusca` selects, a borderless `.tabela` with `Marcador` (✓ squares) and text-link actions, and the sticky `RodapeLista` ("1–20 de 135 usuários" + arrows). `useAbrirAoClicarNaLinha` makes the whole row open the record; list filters live in the URL (`useFiltrosNaUrl`).
  - Forms open in a `Janela` (native `<dialog>` modal: "Cancelar · Título · Salvar" header, the Salvar button submits via `form={id}`, Esc/Cancelar with unsaved changes asks to discard). They are **child routes** of the list (`/admin/produtos/:id` renders `AdminProdutos` + `<Outlet />` → `FormProduto`), and `useVoltarParaLista` closes back to the list keeping its query string.
  - Inside `.cadastro`, fields are underline-style (small gray label, bottom border); file/image fields are rows with the file name and › (`CampoArquivo`, `CampoImagem`); booleans are `.caixa` checkboxes. On phones the window is full screen.
- **Admin responsiveness:** `.admin-conteudo` has no max width and is a size container (`container: conteudo-admin / inline-size`). Admin layouts (dashboard grid, filters, forms, and the table → card switch in `componentes.css`) use `@container conteudo-admin (...)`, not `@media`, so they react to the space next to the sidebar (open or collapsed). Use container queries for new admin layouts too.
- **Styling:** plain CSS files next to their components. Colors, typography and other tokens live only in `src/estilos/tokens.css`; other CSS should use those variables.
  - The look follows the FERSA website (brasil.fersa.com): white background, navy brand color `--marca` for primary actions/focus/active states, pill buttons and search (`--raio-pilula`), gray `--nevoa` panels, and Plus Jakarta Sans for everything.
  - Amber is reserved for "needs attention" (`--atencao*`: pending users, restricted docs). Don't use it as an action color.
  - Headings inherit their color, so text on navy bands is white automatically.
- **Mobile first:** a sticky white header, the global search bar below it, and a fixed bottom nav (`nav-inferior`: Início, Catálogo, Buscar, Manuais, Conta) on phones. The header has no separate "Categorias" tab: "Catálogo" (`/produtos`, the parts grid with filters) stays highlighted on `/categorias` too, which is reached from the catalog filters, the breadcrumb and the home page. The catalog filters render twice: in the desktop sidebar and in a `<dialog className="gaveta">` bottom sheet on mobile. Radio `name`s use `useId()` so the two copies don't share a group.
- **Global search (`Layout.tsx`, `BuscaGlobal`)** is contextual. On `/produtos` and `/documentos` it writes `?busca=` on that page and keeps the other filters; elsewhere it goes to `/busca?q=`, which queries parts and documents in parallel. Pages listed in `SEM_BUSCA_GLOBAL` (home, `/busca`, auth, admin) don't show it.
- **Catalog UI:** `componentes/CartaoPeca.tsx` (part card plus `ImagemPeca`, which draws a bearing when there's no photo), `componentes/Trilha.tsx` (breadcrumb), `lib/medidas.ts` (pt-BR mm/kg formatting with the inch equivalent, and parsing of comma decimals typed in forms).
- **Document cards:** every portal list of documents (library, home, part page, search) uses `GradeDocumentos` from `componentes/CartaoDocumento.tsx`. On phones each card is a row with a small cover; from 40rem it is a vertical card with the title on top (always 3 lines tall so covers line up), the cover and the meta. The title link covers the whole card via `::after`; the download/open button sits above it. `CapaDocumento` is also used in the admin table.
- **Logo:** `componentes/Marca.tsx` picks up `src/assets/marca/fersa.{svg,png,webp}` at build time via `import.meta.glob`; without it, it renders the name as text. Use FERSA's official file. Never redraw the logo.
- `tsconfig` has `noUnusedLocals`/`noUnusedParameters`, so unused imports break `npm run build`.

## Values duplicated between backend and frontend

Keep these in sync:

- Allowed upload extensions: `TIPOS_PERMITIDOS` in `backend/src/lib/armazenamento.ts` ↔ `EXTENSOES_ACEITAS` in `frontend/src/config.ts`.
- Upload size limit: `UPLOAD_LIMITE_MB` (API) ↔ `VITE_UPLOAD_LIMITE_MB` (site; baked in at build time, also a Dockerfile build arg).
- Part photos and document covers: `EXTENSOES_DE_IMAGEM` / `IMAGEM_LIMITE_MB` in `backend/src/lib/armazenamento.ts` ↔ `EXTENSOES` / `LIMITE_MB` in `frontend/src/paginas/admin/CampoImagem.tsx` (used by both forms).
- Part measure fields (`diametroInternoMm`, `diametroExternoMm`, `larguraMm`, `pesoKg`) and the catalog filter params (`internoMin`…`larguraMax`): `validators/produtos.validator.ts` ↔ `api/portal.ts`, `paginas/Produtos.tsx`, `paginas/admin/FormProduto.tsx`.
- Enums (`Perfil`, `Visibilidade`, `TipoDocumento`, `Segmento`, …): `pgEnum`s in `backend/src/models/enums.ts` ↔ `frontend/src/api/tipos.ts`.

## Technical assistant (RAG chat)

The portal's "Suporte técnico" is a chat bubble (bottom right) that answers only about FERSA parts, products and related technical topics, citing the portal's documents, and opens a support ticket (`chamado`) when it doesn't help.

- **Models via Ollama** (local; nothing leaves the server), isolated in `src/lib/ia.ts` (`gerarEmbeddings`, `conversar` streaming, `iaDisponivel`, `IaIndisponivel`). Env: `OLLAMA_URL`, `IA_MODELO_CHAT` (default `qwen2.5:14b`, ~9 tokens/s on an M4), `IA_MODELO_EMBEDDING` (`bge-m3`, 1024 dims = `DIMENSOES_DO_EMBEDDING`; another dimension needs a migration + `ia:indexar -- --todos`).
- **Indexing** (`services/indexacao.service.ts`): each document becomes a "ficha" chunk (title, type, part codes, description, so videos/links are findable) plus text chunks from PDF/TXT/CSV (`lib/assistente/trechos.ts`, ~1200 chars with 200 overlap, each prefixed with title and page). Unreadable files fall back to the ficha only. It runs in an in-process queue after create/update (`agendarIndexacao`), on API start for pending docs, and via `npm run ia:indexar`. Status is derived from `documentos.indexado_em` / `indexacao_erro` vs `atualizado_em` (`situacaoDaIndexacao`) and shown in the admin document window, with "Ler de novo" (`POST /api/admin/documentos/:id/indexar`). Indexing never touches `atualizado_em`.
- **Retrieval** (`repositories/trechos.repository.ts` `buscarParecidos`): cosine distance with **`condicaoDeVisibilidade(usuario)`** (no drafts, not even for admins). Chunks farther than `DISTANCIA_MAXIMA = 0.62` are dropped (calibrated with bge-m3: on-topic ≤ 0.58, off-topic ≥ 0.72). Parts quoted by code (`codigosCitados`) add their catalog sheet (`produtosRepository.buscarAtivosPorCodigos`).
- **Answering** (`services/assistente.service.ts` `responder`, an async generator): the prompt (`lib/assistente/instrucoes.ts`) restricts the scope, forbids inventing specs and asks for `[n]` citations; only cited sources are returned (`fontesCitadas`, with `numero`). Short follow-ups are searched together with the previous question (`textoParaBusca`). The controller streams Server-Sent Events: `conversa`, `texto`, `fim` (`fontes`, `encaminhamento`, `chamado`), `erro`; validation and 404 happen before the stream (plain JSON errors). Ollama down → a fixed message suggesting a ticket.
- **Escalation**: `demonstraInsatisfacao` / `pedeAtendimento` (`lib/assistente/conversa.ts`, accent-insensitive regexes, deterministic) flag messages. First complaint → answer again + `SUGERIR_CHAMADO`; `RECLAMACOES_PARA_ABRIR_CHAMADO` (2) complaints or an explicit request → no LLM call: logged-in users get the ticket opened with their account contact (`CHAMADO_ABERTO`); visitors get `PEDIR_CONTATO` and send name + e-mail/phone to `POST /api/assistente/chamados`. One ticket per conversation (`chamados_conversa_unica`).
- **Data**: `assistente_conversas` (owner `usuario_id`, null for visitors; others' conversations → 404), `assistente_mensagens` (role, content, cited `fontes` jsonb, `insatisfacao`), `chamados` (identity `numero`, contact, `resumo` = the user's questions, status ABERTO/EM_ATENDIMENTO/RESOLVIDO, internal `observacao`). Admin: Suporte › Chamados (list with tabs and an amber open-ticket counter in the menu, window with the whole conversation).
- **Front-end**: `contexto/Assistente.tsx` (state lives in the portal `Layout`, conversation id in `sessionStorage`), `componentes/Assistente.tsx` (bubble + panel; full screen on phones; `TextoFormatado` renders lists/bold/citations without interpreting HTML), `api/assistente.ts` (fetch + SSE parsing). The header "Suporte técnico", `BlocoSuporte`, the home shortcut and "Dúvida sobre a peça" open the chat (`abrir({ rascunho })`). Not shown in `/admin`.
- **Tests**: backend integration tests mock `../src/lib/ia.js` with a topic-based fake embedding (`tests/assistente.test.ts`, including the visibility matrix for retrieval); `IA_INDEXAR_AO_SALVAR=false` in tests (`definirIndexacaoAoSalvar(true)` where needed, `aguardarFilaDeIndexacao()`). The frontend mocks `../../src/api/assistente`. Answer quality still needs the evaluation set (real questions + expected document) before release.
