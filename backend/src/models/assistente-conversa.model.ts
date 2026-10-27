import { pgTable, uuid } from 'drizzle-orm/pg-core';
import { datas } from './colunas.js';
import { usuarios } from './usuario.model.js';

export const assistenteConversas = pgTable('assistente_conversas', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** null = visitante sem login. Só quem começou a conversa pode continuá-la. */
  usuarioId: uuid('usuario_id').references(() => usuarios.id, { onDelete: 'set null' }),
  ...datas,
});

export type AssistenteConversa = typeof assistenteConversas.$inferSelect;
