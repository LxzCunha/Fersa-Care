import { boolean, index, numeric, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { categorias, type Categoria } from './categoria.model.js';
import { datas } from './colunas.js';
import { segmentoProduto } from './enums.js';

const milimetros = (nome: string) => numeric(nome, { precision: 8, scale: 2, mode: 'number' });

export const produtos = pgTable(
  'produtos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    codigo: varchar('codigo', { length: 40 }).notNull().unique('produtos_codigo_unico'),
    nome: varchar('nome', { length: 160 }).notNull(),
    segmento: segmentoProduto('segmento').notNull(),
    categoriaId: uuid('categoria_id').references(() => categorias.id, { onDelete: 'set null' }),
    descricao: text('descricao'),
    /** Texto livre; entra na busca. */
    aplicacoes: text('aplicacoes'),

    diametroInternoMm: milimetros('diametro_interno_mm'),
    diametroExternoMm: milimetros('diametro_externo_mm'),
    larguraMm: milimetros('largura_mm'),
    pesoKg: numeric('peso_kg', { precision: 8, scale: 3, mode: 'number' }),

    imagemChave: varchar('imagem_chave', { length: 120 }),
    ativo: boolean('ativo').notNull().default(true),
    ...datas,
  },
  (t) => [index('produtos_categoria_idx').on(t.categoriaId)],
);

export type Produto = typeof produtos.$inferSelect;
export type NovoProduto = typeof produtos.$inferInsert;

export type LinhaProduto = Produto & { categoria: Pick<Categoria, 'id' | 'nome'> | null };

export type ProdutoResumo = Pick<Produto, 'id' | 'codigo' | 'nome' | 'segmento'>;
