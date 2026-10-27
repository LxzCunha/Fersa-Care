-- Migração escrita à mão (gerada com `drizzle-kit generate --custom`).
-- Roda antes das tabelas porque a coluna documentos.busca depende de f_unaccent.

-- unaccent remove acentos: "manutenção" vira "manutencao".
CREATE EXTENSION IF NOT EXISTS unaccent;
--> statement-breakpoint

-- O unaccent original não é IMMUTABLE, então não pode ser usado em colunas
-- geradas nem em índices. Esta função "embrulha" o unaccent com dicionário fixo
-- e pode ser marcada como IMMUTABLE com segurança.
CREATE OR REPLACE FUNCTION f_unaccent(texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE PARALLEL SAFE STRICT
AS $$
  SELECT public.unaccent('public.unaccent'::regdictionary, texto)
$$;
