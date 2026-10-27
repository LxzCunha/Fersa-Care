import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index.js';

export const PASTA_MIGRACOES = fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function aplicarMigracoes(): Promise<void> {
  await migrate(db, { migrationsFolder: PASTA_MIGRACOES });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await aplicarMigracoes();
    console.log('✅ Migrações aplicadas.');
  } catch (erro) {
    console.error('❌ Falha ao aplicar as migrações:', erro);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
