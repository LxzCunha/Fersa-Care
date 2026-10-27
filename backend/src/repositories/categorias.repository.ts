import { and, asc, count, eq, getTableColumns, gt, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { escaparLike, termosDaBusca } from '../lib/validacao.js';
import { categorias, produtos, type Categoria, type NovaCategoria } from '../models/index.js';
import type { FiltrosCategorias } from '../validators/categorias.validator.js';

/** Acesso à tabela categorias. */

function condicaoDeBusca(busca: string | undefined): SQL | undefined {
  const termos = termosDaBusca(busca ?? '');
  if (termos.length === 0) return undefined;
  return and(
    ...termos.map((termo) => sql`f_unaccent(${categorias.nome}) ILIKE f_unaccent(${`%${escaparLike(termo)}%`})`),
  );
}

/**
 * Categorias com a quantidade de peças de cada uma.
 * - Portal: conta só peças ativas e omite categorias sem nenhuma (evita listas vazias).
 * - Admin: conta todas as peças e mostra todas as categorias.
 */
export function listar(filtros: FiltrosCategorias, opcoes: { somenteComPecasAtivas: boolean }) {
  const totalProdutos = opcoes.somenteComPecasAtivas
    ? sql<number>`count(${produtos.id}) filter (where ${produtos.ativo})`.mapWith(Number)
    : count(produtos.id);

  return db
    .select({ ...getTableColumns(categorias), totalProdutos })
    .from(categorias)
    .leftJoin(produtos, eq(produtos.categoriaId, categorias.id))
    .where(condicaoDeBusca(filtros.busca))
    .groupBy(categorias.id)
    .having(opcoes.somenteComPecasAtivas ? gt(totalProdutos, 0) : undefined)
    .orderBy(asc(categorias.nome));
}

export async function buscarPorId(id: string): Promise<(Categoria & { totalProdutos: number }) | undefined> {
  const [categoria] = await db
    .select({ ...getTableColumns(categorias), totalProdutos: count(produtos.id) })
    .from(categorias)
    .leftJoin(produtos, eq(produtos.categoriaId, categorias.id))
    .where(eq(categorias.id, id))
    .groupBy(categorias.id);
  return categoria;
}

export async function inserir(valores: NovaCategoria): Promise<Categoria> {
  const [categoria] = await db.insert(categorias).values(valores).returning();
  return categoria!;
}

export async function atualizar(id: string, valores: Partial<NovaCategoria>): Promise<Categoria | undefined> {
  const [categoria] = await db
    .update(categorias)
    .set({ ...valores, atualizadoEm: new Date() })
    .where(eq(categorias.id, id))
    .returning();
  return categoria;
}

/** As peças da categoria ficam sem categoria (ON DELETE SET NULL). Devolve false se não existia. */
export async function excluir(id: string): Promise<boolean> {
  const [removida] = await db.delete(categorias).where(eq(categorias.id, id)).returning({ id: categorias.id });
  return removida !== undefined;
}
