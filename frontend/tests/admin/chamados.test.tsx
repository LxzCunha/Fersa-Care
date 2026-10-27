import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../src/api/admin';
import { ErroApi } from '../../src/api/cliente';
import { AdminChamados } from '../../src/paginas/admin/AdminChamados';
import { FormChamado } from '../../src/paginas/admin/FormChamado';
import { umaPagina, umAdmin, umChamado } from '../fabricas';
import { esperarJanela, renderizar } from '../renderizar';

vi.mock('../../src/api/admin');

const rotas = [
  {
    path: '/admin/chamados',
    element: <AdminChamados />,
    children: [{ path: ':id', element: <FormChamado /> }],
  },
];
const abrir = (caminho: string) => renderizar(rotas, { caminho, usuario: umAdmin() });

const aberto = umChamado({ id: 'ch-12', numero: 12 });
const resolvido = umChamado({
  id: 'ch-3',
  numero: 3,
  nome: 'Juliana Prado',
  email: null,
  telefone: '(41) 99999-0002',
  resumo: '• Rolamento esquentando no trator.',
  status: 'RESOLVIDO',
  clienteCadastrado: true,
});

beforeEach(() => {
  vi.mocked(api.listarChamados).mockResolvedValue({
    ...umaPagina([aberto, resolvido]),
    porStatus: { ABERTO: 1, EM_ATENDIMENTO: 0, RESOLVIDO: 1 },
  });
  vi.mocked(api.detalharChamado).mockResolvedValue({
    ...aberto,
    conversa: [
      { id: '1', papel: 'USUARIO', conteudo: 'Meu cubo faz ruído depois da troca.', fontes: [], insatisfacao: false, criadoEm: '' },
      {
        id: '2',
        papel: 'ASSISTENTE',
        conteudo: 'Confira o torque da porca [1].',
        fontes: [{ tipo: 'DOCUMENTO', id: 'd-boletim', titulo: 'Boletim 07/2026', numero: 1 }],
        insatisfacao: false,
        criadoEm: '',
      },
      { id: '3', papel: 'USUARIO', conteudo: 'Não ajudou.', fontes: [], insatisfacao: true, criadoEm: '' },
    ],
  });
});

describe('Lista de chamados', () => {
  it('número, quem pediu (com contato e se é cliente), assunto, situação e data', async () => {
    abrir('/admin/chamados');
    await screen.findByText('Rafael Souza');
    const linha = (nome: string) => screen.getByText(nome).closest('tr')!;

    expect(within(linha('Rafael Souza')).getByRole('link', { name: '#12' })).toHaveAttribute('href', '/admin/chamados/ch-12');
    expect(linha('Rafael Souza')).toHaveTextContent('rafael@exemplo.com · visitante');
    expect(linha('Rafael Souza')).toHaveTextContent('Meu cubo faz ruído depois da troca.');
    expect(linha('Rafael Souza')).not.toHaveTextContent('Não ajudou.');
    expect(within(linha('Rafael Souza')).getByText('Aberto')).toHaveClass('selo-pendente');
    expect(linha('Rafael Souza')).toHaveTextContent('27/10/2026, 13:43');

    expect(linha('Juliana Prado')).toHaveTextContent('(41) 99999-0002 · cliente cadastrado');
    expect(within(linha('Juliana Prado')).getByText('Resolvido')).toHaveClass('selo-ativo');
    expect(screen.getByText('2 chamados')).toBeInTheDocument();
  });

  it('abas com a contagem; "Abertos" filtra pela URL', async () => {
    const { pessoa, endereco } = abrir('/admin/chamados');
    await screen.findByText('Rafael Souza');
    expect(screen.getByRole('button', { name: /Todos/ })).toHaveTextContent('2');
    await pessoa.click(screen.getByRole('button', { name: /Abertos/ }));
    expect(endereco()).toBe('/admin/chamados?status=ABERTO');
    await waitFor(() => expect(api.listarChamados).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ABERTO' })));
  });

  it('busca pelo número ou nome', async () => {
    const { pessoa } = abrir('/admin/chamados');
    await screen.findByText('Rafael Souza');
    await pessoa.type(screen.getByRole('searchbox', { name: /Buscar/ }), '#12');
    await waitFor(() => expect(api.listarChamados).toHaveBeenLastCalledWith(expect.objectContaining({ busca: '#12' })));
  });

  it('sem chamados abertos', async () => {
    vi.mocked(api.listarChamados).mockResolvedValue({ ...umaPagina([]), porStatus: { ABERTO: 0, EM_ATENDIMENTO: 0, RESOLVIDO: 0 } });
    abrir('/admin/chamados?status=ABERTO');
    expect(await screen.findByText('Nenhum chamado aberto')).toBeInTheDocument();
  });
});

describe('Janela do chamado', () => {
  it('mostra o contato e a conversa inteira, com as reclamações e as fontes', async () => {
    abrir('/admin/chamados/ch-12');
    const janela = await esperarJanela('Chamado nº 12');
    expect(within(janela).getByText('Aberto em 27/10/2026, 13:43 · visitante sem login')).toBeInTheDocument();
    expect(within(janela).getByRole('link', { name: 'rafael@exemplo.com' })).toHaveAttribute(
      'href',
      'mailto:rafael@exemplo.com?subject=Chamado nº 12',
    );

    const conversa = within(janela).getAllByRole('listitem');
    expect(conversa).toHaveLength(3);
    expect(conversa[0]).toHaveTextContent('Rafael SouzaMeu cubo faz ruído depois da troca.');
    expect(within(conversa[1]!).getByRole('link', { name: /Boletim 07\/2026/ })).toHaveAttribute('href', '/documentos/d-boletim');
    expect(within(conversa[2]!).getByText('reclamou')).toBeInTheDocument();
  });

  it('muda a situação e anota; salva e volta para a lista', async () => {
    vi.mocked(api.atualizarChamado).mockResolvedValue({ ...aberto, conversa: [] });
    const { pessoa, endereco } = abrir('/admin/chamados/ch-12?status=ABERTO');
    const janela = await esperarJanela('Chamado nº 12');
    await pessoa.selectOptions(within(janela).getByLabelText('Situação'), 'EM_ATENDIMENTO');
    await pessoa.type(within(janela).getByLabelText(/Anotação interna/), 'Liguei para o cliente.');
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(api.atualizarChamado).toHaveBeenCalledWith('ch-12', { status: 'EM_ATENDIMENTO', observacao: 'Liguei para o cliente.' }),
    );
    await waitFor(() => expect(endereco()).toBe('/admin/chamados?status=ABERTO'));
    expect(await screen.findByText('Chamado nº 12 atualizado.')).toBeInTheDocument();
  });

  it('chamado que não existe: a janela mostra o erro', async () => {
    vi.mocked(api.detalharChamado).mockRejectedValue(new ErroApi(404, 'NAO_ENCONTRADO', 'Chamado não encontrado.'));
    abrir('/admin/chamados/nao-existe');
    expect(await screen.findByText(/Chamado não encontrado/)).toBeInTheDocument();
  });
});
