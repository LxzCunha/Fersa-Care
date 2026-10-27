import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

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
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      // Use o pino (lib/log.ts): JSON estruturado, id da requisição e segredos ocultos.
      'no-console': 'error',
    },
  },

  {
    // Comandos de terminal e a validação do .env, que roda antes do logger existir.
    files: ['src/db/**', 'src/config/env.ts'],
    rules: { 'no-console': 'off' },
  },

  {
    files: ['tests/**'],
    rules: {
      // O supertest devolve `body` como any; o expect é a verificação de tipo ali.
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
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
);
