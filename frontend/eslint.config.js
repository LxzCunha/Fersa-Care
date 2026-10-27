import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * ESLint do site (flat config). O typescript-eslint usa as informações de tipo
 * do tsconfig.json (projectService), então regras como no-floating-promises
 * enxergam o que cada função devolve.
 */
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
      // No recomendado ela é só aviso; aqui dependência faltando é erro.
      'react-hooks/exhaustive-deps': 'error',
      // Handlers async no JSX (onSubmit={salvar}) são o padrão do React: o
      // retorno é ignorado e cada um trata os próprios erros com try/catch.
      // Promises passadas para outros lugares continuam sendo conferidas.
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
    },
  },

  {
    // Cada contexto exporta o provedor e o hook que o lê (useAutenticacao…),
    // um par que só faz sentido junto. Editar um desses arquivos recarrega a
    // página em vez de atualizar só o componente, o que aqui é aceitável.
    files: ['src/contexto/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  {
    files: ['tests/**'],
    rules: {
      // Polyfills e funções falsas leem métodos sem chamá-los
      // (URL.createObjectURL ??= ..., expect(objeto.metodo).toHaveBeenCalled()).
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
