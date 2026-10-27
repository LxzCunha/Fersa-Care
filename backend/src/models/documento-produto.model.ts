import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { documentos } from './documento.model.js';
import { produtos } from './produto.model.js';

/** Produtos relacionados a cada documento (N:N). */
export const documentoProdutos = pgTable(
  'documento_produtos',
  {
    documentoId: uuid('documento_id')
      .notNull()
      .references(() => documentos.id, { onDelete: 'cascade' }),
    produtoId: uuid('produto_id')
      .notNull()
      .references(() => produtos.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.documentoId, t.produtoId] }),
    index('documento_produtos_produto_idx').on(t.produtoId),
  ],
);
