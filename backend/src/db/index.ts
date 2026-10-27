import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../config/env.js';
import * as schema from '../models/index.js';

/**
 * Conexão com o PostgreSQL.
 * O Pool mantém algumas conexões abertas e as reaproveita entre requisições.
 */
export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
});

/** Instância do Drizzle ORM usada pelos repositories para consultar o banco. */
export const db = drizzle({ client: pool, schema });

export type BancoDeDados = typeof db;
/** Tipo da transação (db.transaction) — aceita as mesmas consultas que `db`. */
export type Transacao = Parameters<Parameters<BancoDeDados['transaction']>[0]>[0];

/**
 * Roda `trabalho` numa transação: se algo falhar, nada é gravado.
 * Os services usam isto e repassam `tx` para as funções dos repositories.
 * (No Spring, seria o @Transactional.)
 */
export function emTransacao<T>(trabalho: (tx: Transacao) => Promise<T>): Promise<T> {
  return db.transaction(trabalho);
}
