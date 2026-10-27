import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import type { Usuario } from '../src/api/tipos';
import { ProvedorAssistente } from '../src/contexto/Assistente';
import { CHAVE_USUARIO_ATUAL, ProvedorAutenticacao } from '../src/contexto/Autenticacao';
import { ProvedorNotificacoes } from '../src/contexto/Notificacoes';

/**
 * Renderiza uma tela como no site: React Query, login, notificações e rotas.
 * - `rotas`: a árvore de rotas do teste (ou um único elemento, servido em "*");
 * - `caminho`: o endereço inicial, ex.: "/admin/produtos/123?ativo=true";
 * - `usuario`: quem está logado (null = visitante). Nada é buscado na API.
 * Devolve o roteador (para conferir o endereço) e o `usuario` do user-event.
 */
export function renderizar(
  rotas: RouteObject[] | ReactNode,
  { caminho = '/', usuario = null }: { caminho?: string; usuario?: Usuario | null } = {},
) {
  const clienteQuery = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  clienteQuery.setQueryData(CHAVE_USUARIO_ATUAL, usuario);

  const arvore = Array.isArray(rotas) ? rotas : [{ path: '*', element: rotas }];
  const roteador = createMemoryRouter(arvore, { initialEntries: [caminho] });

  const resultado = render(
    <QueryClientProvider client={clienteQuery}>
      <ProvedorAutenticacao>
        <ProvedorNotificacoes>
          <ProvedorAssistente>
            <RouterProvider router={roteador} />
          </ProvedorAssistente>
        </ProvedorNotificacoes>
      </ProvedorAutenticacao>
    </QueryClientProvider>,
  );

  return {
    ...resultado,
    roteador,
    clienteQuery,
    pessoa: userEvent.setup(),
    /** Endereço atual com a consulta, ex.: "/admin/produtos?ativo=true". */
    endereco: () => `${roteador.state.location.pathname}${roteador.state.location.search}`,
  };
}

/**
 * Espera a janela de cadastro com o formulário já carregado e a devolve.
 * (Enquanto busca os dados, a janela tem o mesmo título mas ainda sem "Salvar".)
 */
export async function esperarJanela(titulo: string) {
  await screen.findByRole('button', { name: 'Salvar' }, { timeout: 3000 });
  return screen.getByRole('dialog', { name: titulo });
}
