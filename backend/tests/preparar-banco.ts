import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { garantirQueEhBancoDeTeste, URL_BANCO_TESTE } from './ambiente.js';

/** Roda uma vez antes da suíte: zera o banco de teste e aplica todas as migrações. */
export async function setup() {
  garantirQueEhBancoDeTeste(URL_BANCO_TESTE);

  const pool = new pg.Pool({ connectionString: URL_BANCO_TESTE, max: 1 });
  try {
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
    await pool.query('CREATE SCHEMA public');
    await migrate(drizzle({ client: pool }), {
      migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
    });
  } catch (erro) {
    throw new Error(
      `Não foi possível preparar o banco de teste (${URL_BANCO_TESTE}). ` +
        'Ele existe? Com o docker-compose da raiz ele é criado automaticamente.\n' +
        (erro instanceof Error ? erro.message : String(erro)),
    );
  } finally {
    await pool.end();
  }
}
