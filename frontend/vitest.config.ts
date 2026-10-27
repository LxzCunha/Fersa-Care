import { defineConfig, mergeConfig } from 'vitest/config';
import configuracaoDoVite from './vite.config.ts';

export default mergeConfig(
  configuracaoDoVite,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['tests/**/*.test.{ts,tsx}'],
      setupFiles: ['./tests/preparar.ts'],
      mockReset: true,
      css: false,
      env: { TZ: 'America/Sao_Paulo' },
    },
  }),
);
