import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile();
} catch {
  // Sem arquivo .env: usa as variáveis já definidas no ambiente.
}

/**
 * Configuração do drizzle-kit (ferramenta de linha de comando do ORM).
 *
 * - `npm run db:gerar`  compara os models com as migrações existentes e gera
 *                       um novo arquivo SQL em ./drizzle quando algo mudou.
 * - `npm run db:studio` abre uma interface web para navegar pelos dados.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/models/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://fersa:fersa@localhost:5432/fersa_care',
  },
  strict: true,
  verbose: true,
});
