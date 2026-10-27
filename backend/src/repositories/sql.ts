import { sql, type SQL } from 'drizzle-orm';

export function contarSe(condicao: SQL) {
  return sql<number>`count(*) filter (where ${condicao})`.mapWith(Number);
}
