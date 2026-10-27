import { timestamp } from 'drizzle-orm/pg-core';

/** Colunas de data repetidas em várias tabelas. */
export const datas = {
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
};
