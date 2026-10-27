import '@fontsource-variable/plus-jakarta-sans';
import './estilos/tokens.css';
import './estilos/base.css';
import './estilos/componentes.css';

import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ErroApi } from './api/cliente';
import { App } from './App';
import { CHAVE_USUARIO_ATUAL, ProvedorAutenticacao } from './contexto/Autenticacao';
import { ProvedorNotificacoes } from './contexto/Notificacoes';

const clienteQuery: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (erro) => {
      if (erro instanceof ErroApi && erro.status === 401) {
        void clienteQuery.invalidateQueries({ queryKey: CHAVE_USUARIO_ATUAL });
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (tentativas, erro) => !(erro instanceof ErroApi && erro.status >= 400 && erro.status < 500) && tentativas < 2,
    },
  },
});

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <QueryClientProvider client={clienteQuery}>
      <BrowserRouter>
        <ProvedorAutenticacao>
          <ProvedorNotificacoes>
            <App />
          </ProvedorNotificacoes>
        </ProvedorAutenticacao>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
