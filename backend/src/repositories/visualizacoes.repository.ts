import { asc, count, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { documentos, documentoVisualizacoes } from '../models/index.js';
import { contarSe } from './sql.js';

export async function registrar(documentoId: string, usuarioId: string | null): Promise<void> {
  await db.insert(documentoVisualizacoes).values({ documentoId, usuarioId });
}

export async function contarDoDocumento(documentoId: string): Promise<number> {
  const [contagem] = await db
    .select({ total: count() })
    .from(documentoVisualizacoes)
    .where(eq(documentoVisualizacoes.documentoId, documentoId));
  return contagem?.total ?? 0;
}

export async function resumoDesde(data: Date) {
  const [resumo] = await db
    .select({
      total: count(),
      deVisitantes: contarSe(sql`${documentoVisualizacoes.usuarioId} is null`),
    })
    .from(documentoVisualizacoes)
    .where(gte(documentoVisualizacoes.criadoEm, data));
  return resumo;
}

export function maisAcessadosDesde(data: Date, limite: number) {
  const totalVisualizacoes = count(documentoVisualizacoes.id);
  return db
    .select({
      id: documentos.id,
      titulo: documentos.titulo,
      tipo: documentos.tipo,
      visibilidade: documentos.visibilidade,
      visualizacoes: totalVisualizacoes,
    })
    .from(documentoVisualizacoes)
    .innerJoin(documentos, eq(documentos.id, documentoVisualizacoes.documentoId))
    .where(gte(documentoVisualizacoes.criadoEm, data))
    .groupBy(documentos.id)
    .orderBy(desc(totalVisualizacoes), asc(documentos.titulo))
    .limit(limite);
}

/** Dia em AAAA-MM-DD no fuso informado; dias sem acesso não aparecem. */
export async function contarPorDia(dias: number, fuso: string): Promise<{ dia: string; total: number }[]> {
  const resultado = await db.execute<{ dia: string; total: number }>(sql`
    select to_char(date_trunc('day', ${documentoVisualizacoes.criadoEm} at time zone ${fuso}), 'YYYY-MM-DD') as dia,
           count(*)::int as total
      from ${documentoVisualizacoes}
     where ${documentoVisualizacoes.criadoEm} >= now() - make_interval(days => ${dias})
     group by 1
  `);
  return resultado.rows.map((linha) => ({ dia: linha.dia, total: Number(linha.total) }));
}
