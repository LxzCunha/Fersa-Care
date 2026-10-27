import { index, integer, pgTable, text, timestamp, unique, uuid, vector } from 'drizzle-orm/pg-core';
import { documentos } from './documento.model.js';

/** bge-m3. Trocar de modelo exige uma migração nova e reindexar todos os trechos. */
export const DIMENSOES_DO_EMBEDDING = 1024;

// A busca sempre junta com `documentos` e aplica condicaoDeVisibilidade.
export const documentoTrechos = pgTable(
  'documento_trechos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentoId: uuid('documento_id')
      .notNull()
      .references(() => documentos.id, { onDelete: 'cascade' }),
    ordem: integer('ordem').notNull(),
    conteudo: text('conteudo').notNull(),
    embedding: vector('embedding', { dimensions: DIMENSOES_DO_EMBEDDING }).notNull(),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('documento_trechos_ordem_unica').on(t.documentoId, t.ordem),
    // Cosseno: a busca precisa usar o mesmo operador (<=>) para aproveitar o índice.
    index('documento_trechos_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
  ],
);

export type DocumentoTrecho = typeof documentoTrechos.$inferSelect;
export type NovoDocumentoTrecho = typeof documentoTrechos.$inferInsert;
