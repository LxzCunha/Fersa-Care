import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile();
} catch {
  // Sem arquivo .env: usa as variáveis já definidas no ambiente.
}

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
