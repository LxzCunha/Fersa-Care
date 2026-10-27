import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { assistenteConversas } from './assistente-conversa.model.js';
import { papelMensagem } from './enums.js';

/** Documento ou peça do catálogo usado na resposta, mostrado como fonte embaixo dela. */
export interface FonteDaResposta {
  tipo: 'DOCUMENTO' | 'PRODUTO';
  id: string;
  titulo: string;
  /** O número citado no texto da resposta: [1], [2]... */
  numero: number;
}

/** Cada pergunta e cada resposta da conversa. */
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
    /** A pessoa reclamou que a resposta não ajudou (conta para abrir o chamado). */
    insatisfacao: boolean('insatisfacao').notNull().default(false),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('assistente_mensagens_conversa_idx').on(t.conversaId, t.criadoEm)],
);

export type AssistenteMensagem = typeof assistenteMensagens.$inferSelect;
export type NovaAssistenteMensagem = typeof assistenteMensagens.$inferInsert;
