import { and, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { db, type Transacao } from '../db/index.js';
import { escaparLike, termosDaBusca } from '../lib/validacao.js';
import {
  eventosDeAuditoria,
  type AcaoDeAuditoria,
  type EventoDeAuditoria,
  type NovoEventoDeAuditoria,
} from '../models/index.js';
import type { FiltrosAuditoria } from '../validators/auditoria.validator.js';

/** Trilha de auditoria: só inserção e leitura (o banco recusa UPDATE e DELETE). */

export async function inserir(evento: NovoEventoDeAuditoria, tx?: Transacao): Promise<void> {
  await (tx ?? db).insert(eventosDeAuditoria).values(evento);
}

/** Busca no autor, no alvo, no IP e no código da ação. */
function condicaoDeBusca(busca: string | undefined): SQL | undefined {
  const termos = termosDaBusca(busca ?? '');
  if (termos.length === 0) return undefined;
  return and(
    ...termos.map((termo) => {
      const parecido = `%${escaparLike(termo)}%`;
      return sql`(
        f_unaccent(coalesce(${eventosDeAuditoria.autorNome}, '')) ILIKE f_unaccent(${parecido})
        OR f_unaccent(coalesce(${eventosDeAuditoria.alvoRotulo}, '')) ILIKE f_unaccent(${parecido})
        OR coalesce(${eventosDeAuditoria.ip}, '') ILIKE ${parecido}
        OR ${eventosDeAuditoria.acao} ILIKE ${parecido}
        OR ${eventosDeAuditoria.detalhes}->>'email' ILIKE ${parecido}
      )`;
    }),
  );
}

/** Página de eventos, mais recentes primeiro. `acoes` restringe a um grupo (ex.: só acessos). */
export async function listar(
  filtros: Omit<FiltrosAuditoria, 'grupo'> & { acoes?: readonly AcaoDeAuditoria[] },
): Promise<{ linhas: EventoDeAuditoria[]; total: number }> {
  const onde = and(
    condicaoDeBusca(filtros.busca),
    filtros.acoes ? inArray(eventosDeAuditoria.acao, [...filtros.acoes]) : undefined,
    filtros.acao ? eq(eventosDeAuditoria.acao, filtros.acao) : undefined,
    filtros.autorId ? eq(eventosDeAuditoria.autorId, filtros.autorId) : undefined,
    filtros.alvoTipo ? eq(eventosDeAuditoria.alvoTipo, filtros.alvoTipo) : undefined,
    filtros.alvoId ? eq(eventosDeAuditoria.alvoId, filtros.alvoId) : undefined,
  );

  const [contagem] = await db.select({ total: count() }).from(eventosDeAuditoria).where(onde);
  const linhas = await db
    .select()
    .from(eventosDeAuditoria)
    .where(onde)
    .orderBy(desc(eventosDeAuditoria.criadoEm), desc(eventosDeAuditoria.id))
    .limit(filtros.porPagina)
    .offset((filtros.pagina - 1) * filtros.porPagina);

  return { linhas, total: contagem?.total ?? 0 };
}
