import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * ESLint da API (flat config). O typescript-eslint usa as informações de tipo
 * do tsconfig.json (projectService), então regras como no-floating-promises
 * enxergam o que cada função devolve: uma Promise esquecida sem await vira erro.
 */
export default defineConfig(
  globalIgnores(['dist/', 'coverage/', 'drizzle/', 'uploads/']),

  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Parâmetros e desestruturações descartados de propósito começam com _ (_req, _ignorado).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
      // Tipos importados com `import type`: some do JavaScript gerado e deixa claro o que é só tipo.
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      // Logs passam pelo pino (lib/log.ts): JSON estruturado, id da requisição e segredos ocultos.
      'no-console': 'error',
    },
  },

  {
    // Comandos de terminal (migrar, seed, capas, indexar) e a validação do .env,
    // que roda antes do logger existir: falam com quem está no terminal.
    files: ['src/db/**', 'src/config/env.ts'],
    rules: { 'no-console': 'off' },
  },

  {
    files: ['tests/**'],
    rules: {
      // O supertest devolve `body` como any: os testes leem campos da resposta
      // e conferem com expect, que é justamente a verificação de tipo ali.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      // expect(objeto.metodo).toHaveBeenCalled() lê o método sem chamá-lo.
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  {
    // O próprio eslint.config.js: JavaScript de Node, fora do tsconfig.
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
);
