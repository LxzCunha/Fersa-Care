import { and, count, desc, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { escaparLike, termosDaBusca } from '../lib/validacao.js';
import { chamados, statusChamado, type Chamado, type NovoChamado, type StatusChamado } from '../models/index.js';
import type { FiltrosChamados } from '../validators/chamados.validator.js';

export async function inserir(chamado: NovoChamado): Promise<Chamado> {
  const [novo] = await db.insert(chamados).values(chamado).returning();
  return novo!;
}

export async function buscarPorId(id: string): Promise<Chamado | undefined> {
  const [chamado] = await db.select().from(chamados).where(eq(chamados.id, id)).limit(1);
  return chamado;
}

export async function buscarPorConversa(conversaId: string): Promise<Chamado | undefined> {
  const [chamado] = await db.select().from(chamados).where(eq(chamados.conversaId, conversaId)).limit(1);
  return chamado;
}

/** Também aceita o número do chamado ("12" ou "#12"). */
function condicaoDeBusca(busca: string | undefined): SQL | undefined {
  const termos = termosDaBusca(busca ?? '');
  if (termos.length === 0) return undefined;
  return and(
    ...termos.map((termo) => {
      const numero = /^#?\d+$/.test(termo) ? Number(termo.replace('#', '')) : undefined;
      const parecido = `%${escaparLike(termo)}%`;
      return sql`(
        f_unaccent(${chamados.nome}) ILIKE f_unaccent(${parecido})
        OR ${chamados.email} ILIKE ${parecido}
        OR ${chamados.telefone} ILIKE ${parecido}
        OR f_unaccent(${chamados.resumo}) ILIKE f_unaccent(${parecido})
        ${numero !== undefined ? sql`OR ${chamados.numero} = ${numero}` : sql``}
      )`;
    }),
  );
}

export async function listar(filtros: FiltrosChamados) {
  const busca = condicaoDeBusca(filtros.busca);
  const onde = and(busca, filtros.status ? eq(chamados.status, filtros.status) : undefined);

  const [contagem] = await db.select({ total: count() }).from(chamados).where(onde);
  const linhas = await db
    .select()
    .from(chamados)
    .where(onde)
    .orderBy(desc(chamados.criadoEm))
    .limit(filtros.porPagina)
    .offset((filtros.pagina - 1) * filtros.porPagina);

  const porSituacao = await db
    .select({ status: chamados.status, total: count() })
    .from(chamados)
    .where(busca)
    .groupBy(chamados.status);
  const porStatus = Object.fromEntries(statusChamado.enumValues.map((status) => [status, 0])) as Record<StatusChamado, number>;
  for (const linha of porSituacao) porStatus[linha.status] = linha.total;

  return { linhas, total: contagem?.total ?? 0, porStatus };
}

export async function atualizar(id: string, valores: { status: StatusChamado; observacao: string | null }) {
  const [atualizado] = await db
    .update(chamados)
    .set({ ...valores, atualizadoEm: new Date() })
    .where(eq(chamados.id, id))
    .returning();
  return atualizado;
}
