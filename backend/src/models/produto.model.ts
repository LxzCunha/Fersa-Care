import { boolean, index, numeric, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { categorias, type Categoria } from './categoria.model.js';
import { datas } from './colunas.js';
import { segmentoProduto } from './enums.js';

/** Medidas em milímetros (2 casas, como no catálogo FERSA: 68.26 mm). */
const milimetros = (nome: string) => numeric(nome, { precision: 8, scale: 2, mode: 'number' });

export const produtos = pgTable(
  'produtos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Código impresso na caixa da peça, ex.: "30205". */
    codigo: varchar('codigo', { length: 40 }).notNull().unique('produtos_codigo_unico'),
    nome: varchar('nome', { length: 160 }).notNull(),
    segmento: segmentoProduto('segmento').notNull(),
    /** Excluir a categoria deixa a peça sem categoria (não apaga a peça). */
    categoriaId: uuid('categoria_id').references(() => categorias.id, { onDelete: 'set null' }),
    descricao: text('descricao'),
    /** Veículos e máquinas onde a peça é aplicada (texto livre, entra na busca). */
    aplicacoes: text('aplicacoes'),

    // Medidas principais (vazias para peças em que não se aplicam, como kits e ferramentas).
    diametroInternoMm: milimetros('diametro_interno_mm'),
    diametroExternoMm: milimetros('diametro_externo_mm'),
    larguraMm: milimetros('largura_mm'),
    pesoKg: numeric('peso_kg', { precision: 8, scale: 3, mode: 'number' }),

    /** Foto da peça na pasta de uploads (nome gerado pelo sistema). */
    imagemChave: varchar('imagem_chave', { length: 120 }),
    ativo: boolean('ativo').notNull().default(true),
    ...datas,
  },
  (t) => [index('produtos_categoria_idx').on(t.categoriaId)],
);

export type Produto = typeof produtos.$inferSelect;
export type NovoProduto = typeof produtos.$inferInsert;

/** Um produto como vem das consultas: com o nome da categoria junto. */
export type LinhaProduto = Produto & { categoria: Pick<Categoria, 'id' | 'nome'> | null };

/** Dados do produto que aparecem junto de cada documento. */
export type ProdutoResumo = Pick<Produto, 'id' | 'codigo' | 'nome' | 'segmento'>;
