import { sql } from 'drizzle-orm';
import { pgTable, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { datas } from './colunas.js';

/** Categorias do catálogo (ex.: "Rolamentos de Esferas", "Kits de Roda para Turismo"). */
export const categorias = pgTable(
  'categorias',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: varchar('nome', { length: 120 }).notNull(),
    descricao: text('descricao'),
    ...datas,
  },
  // Nome único sem diferenciar maiúsculas: "Rolamentos de esferas" = "Rolamentos de Esferas".
  (t) => [uniqueIndex('categorias_nome_unico').on(sql`lower(${t.nome})`)],
);

export type Categoria = typeof categorias.$inferSelect;
export type NovaCategoria = typeof categorias.$inferInsert;
