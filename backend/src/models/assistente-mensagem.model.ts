import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { assistenteConversas } from './assistente-conversa.model.js';
import { papelMensagem } from './enums.js';

export interface FonteDaResposta {
  tipo: 'DOCUMENTO' | 'PRODUTO';
  id: string;
  titulo: string;
  /** O [n] citado no texto da resposta. */
  numero: number;
}

export const assistenteMensagens = pgTable(
  'assistente_mensagens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversaId: uuid('conversa_id')
      .notNull()
      .references(() => assistenteConversas.id, { onDelete: 'cascade' }),
    papel: papelMensagem('papel').notNull(),
    conteudo: text('conteudo').notNull(),
    fontes: jsonb('fontes').$type<FonteDaResposta[]>().notNull().default([]),
    insatisfacao: boolean('insatisfacao').notNull().default(false),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('assistente_mensagens_conversa_idx').on(t.conversaId, t.criadoEm)],
);

export type AssistenteMensagem = typeof assistenteMensagens.$inferSelect;
export type NovaAssistenteMensagem = typeof assistenteMensagens.$inferInsert;
