import { defineConfig } from 'vitest/config';
import { PASTA_UPLOADS_TESTE, URL_BANCO_TESTE } from './tests/ambiente.js';

export default defineConfig({
  test: {
    environment: 'node',
    // Os arquivos de integração compartilham o mesmo banco, então rodam um de cada vez.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 15_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: URL_BANCO_TESTE,
      JWT_SEGREDO: 'segredo-usado-somente-nos-testes-automatizados',
      UPLOAD_DIR: PASTA_UPLOADS_TESTE,
      // Os testes nunca chamam o Ollama de verdade: a IA é simulada onde precisa.
      OLLAMA_URL: 'http://127.0.0.1:9',
      IA_INDEXAR_AO_SALVAR: 'false',
    },
    projects: [
      {
        // Funções puras (validadores, DTOs, utilitários): não usam o banco.
        extends: true,
        test: { name: 'unidade', include: ['tests/unidade/**/*.test.ts'] },
      },
      {
        // API de ponta a ponta contra o PostgreSQL de teste.
        extends: true,
        test: {
          name: 'integracao',
          include: ['tests/*.test.ts'],
          // Recria o banco de teste e aplica as migrações uma vez antes de tudo.
          globalSetup: ['./tests/preparar-banco.ts'],
          // Limpa as tabelas antes de cada teste.
          setupFiles: ['./tests/setup.ts'],
        },
      },
    ],
  },
});
