-- Migração escrita à mão (gerada com `drizzle-kit generate --custom --name=pgvector`).
-- Habilita o pgvector: tipo `vector` e busca por similaridade, usados pelo
-- assistente com RAG (docs/RAG.md). Roda antes da tabela documento_trechos.
--
-- O banco precisa ter a extensão instalada. A imagem pgvector/pgvector do
-- docker-compose já vem com ela; um PostgreSQL comum falha aqui.
CREATE EXTENSION IF NOT EXISTS vector;
