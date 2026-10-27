import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist/', 'coverage/']),

  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite(),
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'react-hooks/exhaustive-deps': 'error',
      // Handlers async no JSX (onSubmit={salvar}) são o padrão do React; cada um trata os próprios erros.
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
    },
  },

  {
    // Cada contexto exporta o provedor e o hook que o lê; no Fast Refresh, recarregar a página é aceitável.
    files: ['src/contexto/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  {
    files: ['tests/**'],
    rules: {
      // Polyfills e mocks leem métodos sem chamá-los (expect(objeto.metodo).toHaveBeenCalled()).
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
