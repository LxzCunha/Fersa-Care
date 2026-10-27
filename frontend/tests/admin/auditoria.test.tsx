import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../src/api/admin';
import { AdminAuditoria } from '../../src/paginas/admin/AdminAuditoria';
import { umaPagina, umAdmin, umEventoDeAuditoria } from '../fabricas';
import { renderizar } from '../renderizar';

vi.mock('../../src/api/admin');

const abrir = (caminho = '/admin/auditoria') =>
  renderizar([{ path: '/admin/auditoria', element: <AdminAuditoria /> }], { caminho, usuario: umAdmin() });

const edicao = umEventoDeAuditoria({
  detalhes: { campos: ['titulo'], acessoLiberadoPara: ['u-2'] },
});
const recusado = umEventoDeAuditoria({
  acao: 'LOGIN_RECUSADO',
  autor: null,
  alvo: null,
  detalhes: { email: 'carlos@oficina.com', motivo: 'CREDENCIAIS_INVALIDAS' },
  ip: '189.4.77.10',
  criadoEm: '2026-10-27T16:40:00.000Z',
});
const login = umEventoDeAuditoria({
  acao: 'LOGIN',
  autor: { id: 'u-7', nome: 'Juliana Prado' },
  alvo: { tipo: 'USUARIO', id: 'u-7', rotulo: 'Juliana Prado <juliana@oficina.com>' },
  detalhes: {},
});
const exclusao = umEventoDeAuditoria({
  acao: 'PRODUTO_EXCLUIDO',
  alvo: { tipo: 'PRODUTO', id: 'p-9', rotulo: '30205 · Rolamento cônico' },
  detalhes: {},
});

beforeEach(() => {
  vi.mocked(api.listarAuditoria).mockResolvedValue(umaPagina([edicao, recusado, login, exclusao]));
});

describe('Trilha de auditoria', () => {
  it('quando, quem, ação, registro, detalhes e IP', async () => {
    abrir();
    const linhaDe = async (texto: string) => (await screen.findByText(texto)).closest('tr')!;

    const linhaEdicao = await linhaDe('Boletim 12');
    expect(linhaEdicao).toHaveTextContent('27/10/2026, 13:43');
    expect(linhaEdicao).toHaveTextContent('Administrador FERSA');
    expect(within(linhaEdicao).getByText('Editou documento')).toHaveClass('selo');
    expect(within(linhaEdicao).getByRole('link', { name: 'Boletim 12' })).toHaveAttribute('href', '/admin/documentos/doc-1');
    expect(linhaEdicao).toHaveTextContent('Alterou: título');
    expect(linhaEdicao).toHaveTextContent('Acesso liberado para 1 pessoa');
    expect(linhaEdicao).toHaveTextContent('201.17.4.20');

    // Login recusado de visitante: âmbar, sem autor nem registro, com o e-mail digitado.
    const linhaRecusa = await linhaDe('Login recusado');
    expect(within(linhaRecusa).getByText('Login recusado')).toHaveClass('selo-pendente');
    expect(linhaRecusa).toHaveTextContent('Visitante');
    expect(linhaRecusa).toHaveTextContent('Motivo: e-mail ou senha errados');
    expect(linhaRecusa).toHaveTextContent('E-mail digitado: carlos@oficina.com');

    // Registro excluído aparece pelo nome, sem link.
    const linhaExclusao = await linhaDe('30205 · Rolamento cônico');
    expect(within(linhaExclusao).queryByRole('link')).not.toBeInTheDocument();
    expect(linhaExclusao).toHaveTextContent('Peça');

    // Login: o registro é a própria conta de quem entrou.
    const linhaLogin = await linhaDe('Juliana Prado');
    expect(linhaLogin).toHaveTextContent('Própria conta');
    expect(linhaLogin).not.toHaveTextContent('juliana@oficina.com');

    expect(screen.getByText('4 eventos')).toBeInTheDocument();
    expect(screen.getByText(/Somente leitura/)).toBeInTheDocument();
  });

  it('abas filtram pelo grupo, pela URL', async () => {
    const { pessoa, endereco } = abrir();
    await screen.findByText('Boletim 12');
    expect(api.listarAuditoria).toHaveBeenCalledWith(expect.objectContaining({ grupo: undefined, pagina: 1 }));

    await pessoa.click(screen.getByRole('button', { name: 'Acessos e senhas' }));
    expect(endereco()).toBe('/admin/auditoria?grupo=ACESSOS');
    await waitFor(() => expect(api.listarAuditoria).toHaveBeenLastCalledWith(expect.objectContaining({ grupo: 'ACESSOS' })));
  });

  it('busca por pessoa, registro, IP ou e-mail', async () => {
    const { pessoa } = abrir();
    await screen.findByText('Boletim 12');
    await pessoa.type(screen.getByRole('searchbox', { name: /Buscar/ }), '189.4.77.10');
    await waitFor(() =>
      expect(api.listarAuditoria).toHaveBeenLastCalledWith(expect.objectContaining({ busca: '189.4.77.10' })),
    );
  });

  it('sem eventos', async () => {
    vi.mocked(api.listarAuditoria).mockResolvedValue(umaPagina([]));
    abrir('/admin/auditoria?grupo=ALTERACOES');
    expect(await screen.findByText('Nenhum evento encontrado')).toBeInTheDocument();
  });
});
