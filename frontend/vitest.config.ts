import { defineConfig, mergeConfig } from 'vitest/config';
import configuracaoDoVite from './vite.config.ts';

/**
 * Testes do site: componentes renderizados num DOM simulado (jsdom), com a
 * API trocada por funções falsas (vi.mock). Não precisam da API nem do banco.
 */
export default mergeConfig(
  configuracaoDoVite,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['tests/**/*.test.{ts,tsx}'],
      setupFiles: ['./tests/preparar.ts'],
      // Cada teste começa com as funções falsas zeradas.
      mockReset: true,
      css: false,
      // Datas e horas exibidas no fuso do Brasil, em qualquer máquina.
      env: { TZ: 'America/Sao_Paulo' },
    },
  }),
);
