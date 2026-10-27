import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

/** Consultas da verificação de saúde. */

/** Confirma que o banco responde e que as migrações chegaram até a tabela mais recente. */
export async function bancoPronto(): Promise<boolean> {
  const { rows } = await db.execute<{ tabela: string | null }>(sql`select to_regclass('public.auditoria')::text as tabela`);
  return Boolean(rows[0]?.tabela);
}
