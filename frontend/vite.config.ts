import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Em desenvolvimento o Vite roda em http://localhost:5173 e repassa tudo que
 * começa com /api para a API em http://localhost:3000. Assim o site e a API
 * ficam na "mesma origem" e o cookie de login funciona sem configurar CORS.
 */
const proxyDaApi = {
  '/api': { target: 'http://localhost:3000', changeOrigin: false },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: proxyDaApi },
  preview: { port: 4173, proxy: proxyDaApi },
});
