import { index, integer, pgTable, text, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { assistenteConversas } from './assistente-conversa.model.js';
import { datas } from './colunas.js';
import { statusChamado } from './enums.js';
import { usuarios } from './usuario.model.js';

/**
 * Chamado de suporte técnico, aberto quando o assistente não resolve
 * (a pessoa insiste que não ajudou ou pede atendimento humano).
 * Leva a conversa junto, para o técnico não precisar perguntar tudo de novo.
 */
export const chamados = pgTable(
  'chamados',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Número curto para falar com o cliente ("chamado nº 12"). */
    numero: integer('numero').notNull().generatedAlwaysAsIdentity(),
    conversaId: uuid('conversa_id').references(() => assistenteConversas.id, { onDelete: 'set null' }),
    /** null = visitante (o contato vem do formulário). */
    usuarioId: uuid('usuario_id').references(() => usuarios.id, { onDelete: 'set null' }),
    nome: varchar('nome', { length: 120 }).notNull(),
    email: varchar('email', { length: 180 }),
    telefone: varchar('telefone', { length: 30 }),
    /** O que a pessoa precisa, em poucas linhas (as perguntas da conversa). */
    resumo: text('resumo').notNull(),
    status: statusChamado('status').notNull().default('ABERTO'),
    /** Anotação interna da equipe técnica. */
    observacao: text('observacao'),
    ...datas,
  },
  (t) => [
    unique('chamados_numero_unico').on(t.numero),
    // Uma conversa vira no máximo um chamado (insistir de novo não duplica).
    unique('chamados_conversa_unica').on(t.conversaId),
    index('chamados_status_idx').on(t.status, t.criadoEm),
  ],
);

export type Chamado = typeof chamados.$inferSelect;
export type NovoChamado = typeof chamados.$inferInsert;
