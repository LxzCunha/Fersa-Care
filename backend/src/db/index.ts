import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../config/env.js';
import * as schema from '../models/index.js';

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
});

export const db = drizzle({ client: pool, schema });

export type BancoDeDados = typeof db;
export type Transacao = Parameters<Parameters<BancoDeDados['transaction']>[0]>[0];

export function emTransacao<T>(trabalho: (tx: Transacao) => Promise<T>): Promise<T> {
  return db.transaction(trabalho);
}
