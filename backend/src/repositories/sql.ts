import { sql, type SQL } from 'drizzle-orm';

/** Pedaços de SQL reaproveitados pelos repositories. */

/** count(*) FILTER (WHERE ...) — conta só as linhas que atendem à condição. */
export function contarSe(condicao: SQL) {
  return sql<number>`count(*) filter (where ${condicao})`.mapWith(Number);
}
