import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index.js';

/**
 * Aplica no banco as migrações SQL da pasta ./drizzle que ainda não rodaram.
 * O Drizzle registra o que já foi aplicado na tabela drizzle.__drizzle_migrations,
 * então rodar este script várias vezes é seguro.
 *
 * Uso: npm run db:migrar
 */
export const PASTA_MIGRACOES = fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function aplicarMigracoes(): Promise<void> {
  await migrate(db, { migrationsFolder: PASTA_MIGRACOES });
}

// Executa apenas quando chamado direto pela linha de comando.
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
