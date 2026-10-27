import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../src/api/admin';
import { ErroApi } from '../../src/api/cliente';
import { AdminUsuarios } from '../../src/paginas/admin/AdminUsuarios';
import { FormUsuario } from '../../src/paginas/admin/FormUsuario';
import { umaPaginaDeUsuarios, umAdmin, umUsuario, umUsuarioDetalhado } from '../fabricas';
import { esperarJanela, renderizar } from '../renderizar';

vi.mock('../../src/api/admin');

const rotas = [
  {
    path: '/admin/usuarios',
    element: <AdminUsuarios />,
    children: [
      { path: 'novo', element: <FormUsuario /> },
      { path: ':id', element: <FormUsuario /> },
    ],
  },
];

const eu = umAdmin({ id: 'u-eu', nome: 'Administrador FERSA' });
const abrir = (caminho: string) => renderizar(rotas, { caminho, usuario: eu });

const pendente = umUsuario({
  id: 'u-pendente',
  nome: 'Rafael Souza',
  email: 'pendente@exemplo.com',
  empresa: 'Mecânica Diesel',
  status: 'PENDENTE',
});
const ativo = umUsuario({
  id: 'u-ativo',
  nome: 'Carlos Mendes',
  email: 'oficina@exemplo.com',
  ultimoAcessoEm: '2026-10-27T16:43:00.000Z',
});
const inativo = umUsuario({ id: 'u-inativo', nome: 'Ana Lima', email: 'ana@exemplo.com', status: 'INATIVO', empresa: null });

beforeEach(() => {
  vi.mocked(api.listarUsuarios).mockResolvedValue(umaPaginaDeUsuarios([pendente, ativo, inativo, eu]));
  vi.mocked(api.detalharUsuario).mockResolvedValue(umUsuarioDetalhado(ativo));
});

describe('Lista de usuários', () => {
  it('mostra nome, e-mail, empresa, perfil, se está ativo e o último acesso', async () => {
    abrir('/admin/usuarios');
    await screen.findByText('Rafael Souza');

    const linha = (nome: string) => screen.getByText(nome).closest('tr')!;
    expect(linha('Rafael Souza')).toHaveTextContent('pendente@exemplo.com');
    expect(linha('Rafael Souza')).toHaveTextContent('Mecânica Diesel');
    expect(within(linha('Rafael Souza')).getByText('Aguardando')).toBeInTheDocument();
    expect(linha('Rafael Souza')).toHaveTextContent('Cadastro em 20 de out de 2026');

    expect(within(linha('Carlos Mendes')).getByRole('img', { name: 'Ativo: sim' })).toBeInTheDocument();
    expect(linha('Carlos Mendes')).toHaveTextContent('27/10/2026, 13:43');
    expect(within(linha('Ana Lima')).getByRole('img', { name: 'Ativo: não' })).toBeInTheDocument();
    expect(linha('Ana Lima')).toHaveTextContent('—');

    // O próprio admin aparece marcado.
    expect(screen.getByRole('link', { name: 'Administrador FERSA (você)' })).toBeInTheDocument();
    expect(linha('Administrador FERSA (você)')).toHaveTextContent('Administrador');
  });

  it('abas com a contagem por situação; escolher uma filtra pela URL', async () => {
    const { pessoa, endereco } = abrir('/admin/usuarios');
    await screen.findByText('Rafael Souza');
    expect(screen.getByRole('button', { name: /Todos/ })).toHaveTextContent('4');
    expect(screen.getByRole('button', { name: /Aguardando aprovação/ })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /Ativos/ })).toHaveTextContent('2');

    await pessoa.click(screen.getByRole('button', { name: /Aguardando aprovação/ }));
    expect(endereco()).toBe('/admin/usuarios?status=PENDENTE');
    await waitFor(() => expect(api.listarUsuarios).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'PENDENTE' })));
  });

  it('só os pendentes têm "Aprovar" e "Recusar"', async () => {
    abrir('/admin/usuarios');
    await screen.findByText('Rafael Souza');
    expect(screen.getAllByRole('button', { name: 'Aprovar' })).toHaveLength(1);
    expect(within(screen.getByText('Rafael Souza').closest('tr')!).getByRole('button', { name: 'Aprovar' })).toBeInTheDocument();
  });

  it('aprovar libera o acesso e avisa', async () => {
    vi.mocked(api.alterarStatusUsuario).mockResolvedValue({ ...pendente, status: 'ATIVO' });
    const { pessoa } = abrir('/admin/usuarios');
    await pessoa.click(await screen.findByRole('button', { name: 'Aprovar' }));
    await waitFor(() => expect(api.alterarStatusUsuario).toHaveBeenCalledWith('u-pendente', 'ATIVO'));
    expect(await screen.findByText('Acesso de Rafael Souza liberado.')).toBeInTheDocument();
  });

  it('recusar pede confirmação antes', async () => {
    vi.mocked(api.alterarStatusUsuario).mockResolvedValue({ ...pendente, status: 'INATIVO' });
    const { pessoa } = abrir('/admin/usuarios');
    await pessoa.click(await screen.findByRole('button', { name: 'Recusar' }));
    expect(api.alterarStatusUsuario).not.toHaveBeenCalled();

    const confirmacao = screen.getByRole('dialog', { name: 'Recusar solicitação?' });
    expect(confirmacao).toHaveTextContent('Rafael Souza não vai conseguir entrar no portal.');
    await pessoa.click(within(confirmacao).getByRole('button', { name: 'Recusar acesso' }));
    await waitFor(() => expect(api.alterarStatusUsuario).toHaveBeenCalledWith('u-pendente', 'INATIVO'));
  });

  it('sem pendentes, a aba de aprovação explica o que aparece ali', async () => {
    vi.mocked(api.listarUsuarios).mockResolvedValue(umaPaginaDeUsuarios([]));
    abrir('/admin/usuarios?status=PENDENTE');
    expect(await screen.findByText('Nenhuma solicitação aguardando')).toBeInTheDocument();
  });
});

describe('Cadastro de usuário', () => {
  it('cria com senha gerada pelo botão "Gerar senha"', async () => {
    vi.mocked(api.criarUsuario).mockResolvedValue(ativo);
    const { pessoa, endereco } = abrir('/admin/usuarios/novo');
    const janela = await esperarJanela('Novo usuário');

    await pessoa.type(within(janela).getByLabelText('Nome completo'), 'Marina Costa');
    await pessoa.type(within(janela).getByLabelText('E-mail'), 'marina@exemplo.com');
    await pessoa.type(within(janela).getByLabelText(/Empresa/), 'Distribuidora Sul');
    await pessoa.click(within(janela).getByRole('button', { name: 'Gerar senha' }));
    const senha = (within(janela).getByLabelText('Senha') as HTMLInputElement).value;
    expect(senha).toMatch(/^[A-Za-z][A-Za-z0-9]{8}[0-9]$/);

    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(api.criarUsuario).toHaveBeenCalledWith({
        nome: 'Marina Costa',
        email: 'marina@exemplo.com',
        empresa: 'Distribuidora Sul',
        telefone: '',
        perfil: 'USUARIO',
        status: 'ATIVO',
        senha,
      }),
    );
    await waitFor(() => expect(endereco()).toBe('/admin/usuarios'));
    expect(await screen.findByText('Marina Costa foi cadastrado. Envie a senha inicial para a pessoa.')).toBeInTheDocument();
  });

  it('pode criar um administrador', async () => {
    vi.mocked(api.criarUsuario).mockResolvedValue(ativo);
    const { pessoa } = abrir('/admin/usuarios/novo');
    const janela = await esperarJanela('Novo usuário');
    await pessoa.click(within(janela).getByRole('radio', { name: /Administrador/ }));
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.criarUsuario).toHaveBeenCalledWith(expect.objectContaining({ perfil: 'ADMIN' })));
  });

  it('e-mail repetido (409) aparece no topo', async () => {
    vi.mocked(api.criarUsuario).mockRejectedValue(new ErroApi(409, 'CONFLITO', 'Este e-mail já está cadastrado.'));
    const { pessoa } = abrir('/admin/usuarios/novo');
    const janela = await esperarJanela('Novo usuário');
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));
    expect(await within(janela).findByText(/Este e-mail já está cadastrado/)).toBeInTheDocument();
  });

  it('senha fraca: a mensagem da API aparece embaixo da senha', async () => {
    vi.mocked(api.criarUsuario).mockRejectedValue(
      new ErroApi(400, 'DADOS_INVALIDOS', 'Dados inválidos.', [{ campo: 'senha', mensagem: 'Use letras e números.' }]),
    );
    const { pessoa } = abrir('/admin/usuarios/novo');
    const janela = await esperarJanela('Novo usuário');
    await pessoa.type(within(janela).getByLabelText('Senha'), 'abcdefgh');
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));
    expect(await within(janela).findByText('Use letras e números.')).toBeInTheDocument();
  });
});

describe('Edição de usuário', () => {
  it('abre preenchida com cadastro e último acesso', async () => {
    abrir('/admin/usuarios/u-ativo');
    const janela = await esperarJanela('Usuário');
    expect(within(janela).getByLabelText('Nome completo')).toHaveValue('Carlos Mendes');
    expect(within(janela).getByLabelText('E-mail')).toHaveValue('oficina@exemplo.com');
    expect(within(janela).getByLabelText('Situação')).toHaveValue('ATIVO');
    expect(within(janela).getByRole('radio', { name: /Cliente/ })).toBeChecked();
    expect(within(janela).getByText(/Cadastro em 20 de out de 2026 · último acesso em 27\/10\/2026, 13:43/)).toBeInTheDocument();
  });

  it('senha em branco mantém a atual (não manda novaSenha)', async () => {
    vi.mocked(api.atualizarUsuario).mockResolvedValue(ativo);
    const { pessoa } = abrir('/admin/usuarios/u-ativo');
    const janela = await esperarJanela('Usuário');
    await pessoa.selectOptions(within(janela).getByLabelText('Situação'), 'INATIVO');
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(api.atualizarUsuario).toHaveBeenCalledOnce());
    const [id, dados] = vi.mocked(api.atualizarUsuario).mock.calls[0]!;
    expect(id).toBe('u-ativo');
    expect(dados).toMatchObject({ nome: 'Carlos Mendes', status: 'INATIVO' });
    expect(dados).not.toHaveProperty('novaSenha');
    expect(await screen.findByText('Usuário atualizado.')).toBeInTheDocument();
  });

  it('senha preenchida redefine a senha da pessoa', async () => {
    vi.mocked(api.atualizarUsuario).mockResolvedValue(ativo);
    const { pessoa } = abrir('/admin/usuarios/u-ativo');
    const janela = await esperarJanela('Usuário');
    await pessoa.type(within(janela).getByLabelText(/Nova senha/), 'NovaSenha123');
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(api.atualizarUsuario).toHaveBeenCalledWith('u-ativo', expect.objectContaining({ novaSenha: 'NovaSenha123' })),
    );
    expect(await screen.findByText('Usuário atualizado e senha redefinida.')).toBeInTheDocument();
  });

  it('a própria conta: perfil e situação travados e sem "Excluir"', async () => {
    vi.mocked(api.detalharUsuario).mockResolvedValue(umUsuarioDetalhado(eu));
    abrir('/admin/usuarios/u-eu');
    const janela = await esperarJanela('Usuário');
    expect(within(janela).getByText('Você não pode alterar o próprio perfil nem a própria situação.')).toBeInTheDocument();
    expect(within(janela).getByRole('radio', { name: /Administrador/ })).toBeDisabled();
    expect(within(janela).getByLabelText('Situação')).toBeDisabled();
    expect(within(janela).queryByRole('button', { name: 'Excluir usuário' })).toBeNull();
  });

  it('lista os documentos restritos liberados para a pessoa', async () => {
    vi.mocked(api.detalharUsuario).mockResolvedValue(
      umUsuarioDetalhado({ ...ativo, documentosLiberados: [{ id: 'd1', titulo: 'Condições comerciais', tipo: 'OUTRO' }] }),
    );
    abrir('/admin/usuarios/u-ativo');
    const janela = await esperarJanela('Usuário');
    expect(within(janela).getByRole('link', { name: 'Condições comerciais' })).toHaveAttribute('href', '/admin/documentos/d1');
  });

  it('excluir pede confirmação e apaga', async () => {
    vi.mocked(api.excluirUsuario).mockResolvedValue(undefined);
    const { pessoa, endereco } = abrir('/admin/usuarios/u-ativo');
    const janela = await esperarJanela('Usuário');
    await pessoa.click(within(janela).getByRole('button', { name: 'Excluir usuário' }));
    const confirmacao = screen.getByRole('dialog', { name: 'Excluir este usuário?' });
    await pessoa.click(within(confirmacao).getByRole('button', { name: 'Excluir usuário' }));
    await waitFor(() => expect(api.excluirUsuario).toHaveBeenCalledWith('u-ativo'));
    await waitFor(() => expect(endereco()).toBe('/admin/usuarios'));
    expect(await screen.findByText('Usuário excluído.')).toBeInTheDocument();
  });
});
