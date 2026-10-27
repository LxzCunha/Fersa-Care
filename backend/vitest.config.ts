import { defineConfig } from 'vitest/config';
import { PASTA_UPLOADS_TESTE, URL_BANCO_TESTE } from './tests/ambiente.js';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Recria o banco de teste e aplica as migrações uma vez antes de tudo.
    globalSetup: ['./tests/preparar-banco.ts'],
    // Limpa as tabelas antes de cada teste.
    setupFiles: ['./tests/setup.ts'],
    // Os arquivos de teste compartilham o mesmo banco, então rodam um de cada vez.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 15_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: URL_BANCO_TESTE,
      JWT_SEGREDO: 'segredo-usado-somente-nos-testes-automatizados',
      UPLOAD_DIR: PASTA_UPLOADS_TESTE,
    },
  },
});
