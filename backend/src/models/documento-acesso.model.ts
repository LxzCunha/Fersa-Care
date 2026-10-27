import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { documentos } from './documento.model.js';
import { usuarios } from './usuario.model.js';

export const documentoAcessos = pgTable(
  'documento_acessos',
  {
    documentoId: uuid('documento_id')
      .notNull()
      .references(() => documentos.id, { onDelete: 'cascade' }),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    concedidoEm: timestamp('concedido_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.documentoId, t.usuarioId] }),
    index('documento_acessos_usuario_idx').on(t.usuarioId),
  ],
);
