import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Proxy de /api para a API: site e API na mesma origem, então o cookie de login funciona sem CORS.
const proxyDaApi = {
  '/api': { target: 'http://localhost:3000', changeOrigin: false },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: proxyDaApi },
  preview: { port: 4173, proxy: proxyDaApi },
});
