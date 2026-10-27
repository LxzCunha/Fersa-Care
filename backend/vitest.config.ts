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
      // Porta sem serviço: os testes nunca chamam o Ollama de verdade (a IA é simulada).
      OLLAMA_URL: 'http://127.0.0.1:9',
      IA_INDEXAR_AO_SALVAR: 'false',
    },
    projects: [
      {
        extends: true,
        test: { name: 'unidade', include: ['tests/unidade/**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'integracao',
          include: ['tests/*.test.ts'],
          globalSetup: ['./tests/preparar-banco.ts'],
          setupFiles: ['./tests/setup.ts'],
        },
      },
    ],
  },
});
