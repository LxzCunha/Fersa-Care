import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../src/api/admin';
import { LayoutAdmin } from '../../src/paginas/admin/LayoutAdmin';
import { umaPagina, umaPaginaDeUsuarios, umAdmin } from '../fabricas';
import { renderizar } from '../renderizar';

vi.mock('../../src/api/admin');

const rotas = [
  {
    path: '/admin',
    element: <LayoutAdmin />,
    children: [
      { index: true, element: <p>Conteúdo do painel</p> },
      { path: '*', element: <p>Conteúdo da página</p> },
    ],
  },
];
const abrir = (caminho: string) => renderizar(rotas, { caminho, usuario: umAdmin() });
const trilha = () => screen.getByRole('navigation', { name: 'Você está em' });

beforeEach(() => {
  vi.mocked(api.listarUsuarios).mockResolvedValue(umaPaginaDeUsuarios([]));
  vi.mocked(api.listarChamados).mockResolvedValue({
    ...umaPagina([]),
    porStatus: { ABERTO: 0, EM_ATENDIMENTO: 0, RESOLVIDO: 0 },
  });
});

describe('Trilha no topo da administração', () => {
  it('cada nível é um link de volta; a página aberta fica marcada', async () => {
    abrir('/admin/auditoria?grupo=ACESSOS');
    await screen.findByText('Conteúdo da página');
    expect(within(trilha()).getByRole('link', { name: 'Painel' })).toHaveAttribute('href', '/admin');
    expect(within(trilha()).getByRole('link', { name: 'Segurança' })).toHaveAttribute('href', '/admin/auditoria');
    expect(within(trilha()).getByText('Acessos e senhas')).toHaveAttribute('aria-current', 'page');
  });

  it('com um registro aberto, volta para a lista mantendo os filtros', async () => {
    const { pessoa, endereco } = abrir('/admin/produtos/123?ativo=true');
    await screen.findByText('Conteúdo da página');
    expect(within(trilha()).getByText('Editar peça')).toHaveAttribute('aria-current', 'page');

    await pessoa.click(within(trilha()).getByRole('link', { name: 'Peças' }));
    expect(endereco()).toBe('/admin/produtos?ativo=true');

    await pessoa.click(within(trilha()).getByRole('link', { name: 'Painel' }));
    expect(endereco()).toBe('/admin');
    expect(await screen.findByText('Conteúdo do painel')).toBeInTheDocument();
    expect(within(trilha()).queryByRole('link')).not.toBeInTheDocument();
  });
});
