# 0006. Testes de integração contra um PostgreSQL de verdade

- **Situação:** aceita
- **Data:** 2026-10

## Contexto

As regras mais importantes vivem em SQL: visibilidade, busca sem acento (`unaccent`), códigos de peça sem pontuação, `tsvector`, pgvector, restrições de unicidade e o gatilho da auditoria. Um banco simulado ou SQLite não executaria nenhuma delas.

## Decisão

- Dois projetos no Vitest: `unidade` (funções puras, sem banco, cerca de 1 s) e `integracao` (a API inteira via Supertest contra o banco `fersa_care_teste`).
- Antes da rodada, o banco de teste é recriado do zero aplicando as migrações reais; antes de cada teste, as tabelas são esvaziadas (`TRUNCATE`). Uma trava recusa rodar num banco cujo nome não tenha "test".
- Os cenários são montados inserindo direto no banco (`tests/ajudantes.ts`); só a IA é simulada.
- No site, a API é simulada (`vi.mock`) e os testes usam Testing Library, como uma pessoa usaria a tela.

## Alternativas consideradas

- **Mocks dos repositories:** testes rápidos que passariam com o SQL errado.
- **Testcontainers:** sobe um banco por rodada sem configuração; fica como evolução. Hoje o `docker compose` e o serviço do CI cumprem o papel.

## Consequências

- Os testes de integração rodam em série (compartilham o banco) e precisam do PostgreSQL com pgvector no ar.
- As migrações são testadas em toda execução.
- Tabela nova precisa entrar na lista do `TRUNCATE` em `tests/setup.ts`.
