import { and, asc, count, eq, getTableColumns, gte, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import { db, type Transacao } from '../db/index.js';
import { escaparLike, somenteLetrasENumeros, termosDaBusca } from '../lib/validacao.js';
import {
  categorias,
  documentoProdutos,
  produtos,
  type LinhaProduto,
  type NovoProduto,
  type Produto,
} from '../models/index.js';
import type { FiltrosProdutos } from '../validators/produtos.validator.js';
import { contarSe } from './sql.js';

/** Acesso à tabela produtos (catálogo de peças). */

/** Colunas do produto + id e nome da categoria (null quando a peça não tem categoria). */
const colunasDoProduto = {
  ...getTableColumns(produtos),
  categoria: { id: categorias.id, nome: categorias.nome },
};

/**
 * Cada termo precisa aparecer no código (sem espaços/hífens), nome, aplicação,
 * descrição ou no nome da categoria ("esferas" encontra "Rolamentos de Esferas").
 */
function condicaoDeBusca(busca: string | undefined): SQL | undefined {
  const termos = termosDaBusca(busca ?? '');
  if (termos.length === 0) return undefined;

  return and(
    ...termos.map((termo) => {
      const padrao = `%${escaparLike(termo)}%`;
      const codigo = somenteLetrasENumeros(termo);
      return or(
        codigo
          ? sql`regexp_replace(${produtos.codigo}, '[^[:alnum:]]', '', 'g') ILIKE ${`%${escaparLike(codigo)}%`}`
          : undefined,
        sql`f_unaccent(${produtos.nome}) ILIKE f_unaccent(${padrao})`,
        sql`f_unaccent(coalesce(${produtos.aplicacoes}, '')) ILIKE f_unaccent(${padrao})`,
        sql`f_unaccent(coalesce(${produtos.descricao}, '')) ILIKE f_unaccent(${padrao})`,
        sql`f_unaccent(coalesce(${categorias.nome}, '')) ILIKE f_unaccent(${padrao})`,
      );
    }),
  );
}

/** Faixa de medida (mín./máx. em mm). Peças sem a medida cadastrada ficam de fora. */
function entre(coluna: typeof produtos.diametroInternoMm, minimo?: number, maximo?: number) {
  return and(
    minimo !== undefined ? gte(coluna, minimo) : undefined,
    maximo !== undefined ? lte(coluna, maximo) : undefined,
  );
}

interface OpcoesDeListagem {
  /** false = só produtos ativos (portal); true = todos, com o filtro `ativo` opcional (admin). */
  incluirInativos: boolean;
}

export async function listar(
  filtros: FiltrosProdutos,
  opcoes: OpcoesDeListagem,
): Promise<{ linhas: LinhaProduto[]; total: number }> {
  const onde = and(
    condicaoDeBusca(filtros.busca),
    filtros.segmento ? eq(produtos.segmento, filtros.segmento) : undefined,
    filtros.categoriaId ? eq(produtos.categoriaId, filtros.categoriaId) : undefined,
    entre(produtos.diametroInternoMm, filtros.internoMin, filtros.internoMax),
    entre(produtos.diametroExternoMm, filtros.externoMin, filtros.externoMax),
    entre(produtos.larguraMm, filtros.larguraMin, filtros.larguraMax),
    opcoes.incluirInativos
      ? filtros.ativo !== undefined
        ? eq(produtos.ativo, filtros.ativo)
        : undefined
      : eq(produtos.ativo, true),
  );

  const [contagem] = await db
    .select({ total: count() })
    .from(produtos)
    .leftJoin(categorias, eq(categorias.id, produtos.categoriaId))
    .where(onde);
  const linhas = await db
    .select(colunasDoProduto)
    .from(produtos)
    .leftJoin(categorias, eq(categorias.id, produtos.categoriaId))
    .where(onde)
    .orderBy(asc(produtos.codigo))
    .limit(filtros.porPagina)
    .offset((filtros.pagina - 1) * filtros.porPagina);

  return { linhas, total: contagem?.total ?? 0 };
}

export async function buscarPorId(id: string, opcoes: OpcoesDeListagem): Promise<LinhaProduto | undefined> {
  const [produto] = await db
    .select(colunasDoProduto)
    .from(produtos)
    .leftJoin(categorias, eq(categorias.id, produtos.categoriaId))
    .where(and(eq(produtos.id, id), opcoes.incluirInativos ? undefined : eq(produtos.ativo, true)))
    .limit(1);
  return produto;
}

/**
 * Peças do catálogo (ativas) cujo código, sem espaços e hífens, é um dos
 * informados. O assistente usa para trazer a ficha da peça citada na pergunta.
 */
export function buscarAtivosPorCodigos(codigosSemEspacos: string[]): Promise<LinhaProduto[]> {
  if (codigosSemEspacos.length === 0) return Promise.resolve([]);
  return db
    .select(colunasDoProduto)
    .from(produtos)
    .leftJoin(categorias, eq(categorias.id, produtos.categoriaId))
    .where(
      and(
        eq(produtos.ativo, true),
        inArray(sql`upper(regexp_replace(${produtos.codigo}, '[^[:alnum:]]', '', 'g'))`, codigosSemEspacos),
      ),
    )
    .orderBy(asc(produtos.codigo))
    .limit(5);
}

/** Quantos documentos estão ligados ao produto (sem filtro de acesso: uso do admin). */
export async function contarDocumentosRelacionados(id: string): Promise<number> {
  const [contagem] = await db
    .select({ total: count() })
    .from(documentoProdutos)
    .where(eq(documentoProdutos.produtoId, id));
  return contagem?.total ?? 0;
}

/** Quantos dos ids informados existem (para conferir referências antes de gravar). */
export async function contarExistentes(ids: string[], tx: Transacao): Promise<number> {
  const encontrados = await tx.select({ id: produtos.id }).from(produtos).where(inArray(produtos.id, ids));
  return encontrados.length;
}

export async function inserir(valores: NovoProduto): Promise<Produto> {
  const [produto] = await db.insert(produtos).values(valores).returning();
  return produto!;
}

export async function atualizar(id: string, valores: Partial<NovoProduto>): Promise<Produto | undefined> {
  const [produto] = await db
    .update(produtos)
    .set({ ...valores, atualizadoEm: new Date() })
    .where(eq(produtos.id, id))
    .returning();
  return produto;
}

/** Exclui e devolve a chave da foto (para apagá-la do disco), ou undefined se não existia. */
export async function excluir(id: string): Promise<{ imagemChave: string | null } | undefined> {
  const [removido] = await db
    .delete(produtos)
    .where(eq(produtos.id, id))
    .returning({ imagemChave: produtos.imagemChave });
  return removido;
}

/** Totais para o painel do administrador. */
export async function resumoParaPainel() {
  const [resumo] = await db
    .select({ total: count(), ativos: contarSe(sql`${produtos.ativo}`) })
    .from(produtos);
  return resumo;
}
