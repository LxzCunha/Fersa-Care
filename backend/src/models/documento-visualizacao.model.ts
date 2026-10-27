import { bigint, index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { documentos } from './documento.model.js';
import { usuarios } from './usuario.model.js';

export const documentoVisualizacoes = pgTable(
  'documento_visualizacoes',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    documentoId: uuid('documento_id')
      .notNull()
      .references(() => documentos.id, { onDelete: 'cascade' }),
    /** null = visitante sem login */
    usuarioId: uuid('usuario_id').references(() => usuarios.id, { onDelete: 'set null' }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('documento_visualizacoes_documento_idx').on(t.documentoId),
    index('documento_visualizacoes_data_idx').on(t.criadoEm),
  ],
);
