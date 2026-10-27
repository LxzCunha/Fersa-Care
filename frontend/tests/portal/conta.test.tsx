import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../../src/api/auth';
import { ErroApi } from '../../src/api/cliente';
import { MinhaConta } from '../../src/paginas/MinhaConta';
import { umUsuario } from '../fabricas';
import { renderizar } from '../renderizar';

vi.mock('../../src/api/auth');

const rotas = [
  { path: '/minha-conta', element: <MinhaConta /> },
  { path: '/', element: <p>Página inicial</p> },
];
const abrir = () => renderizar(rotas, { caminho: '/minha-conta', usuario: umUsuario() });

beforeEach(() => {
  vi.mocked(authApi.encerrarOutrasSessoes).mockResolvedValue(undefined);
  vi.mocked(authApi.sair).mockResolvedValue(undefined);
});

describe('Minha conta: segurança da sessão', () => {
  it('"Sair dos outros dispositivos" encerra as outras sessões e confirma', async () => {
    const { pessoa } = abrir();
    await pessoa.click(screen.getByRole('button', { name: 'Sair dos outros dispositivos' }));
    expect(authApi.encerrarOutrasSessoes).toHaveBeenCalledOnce();
    expect(await screen.findByText('Pronto: só este navegador continua conectado à sua conta.')).toBeInTheDocument();
  });

  it('se a API falhar, avisa o erro', async () => {
    vi.mocked(authApi.encerrarOutrasSessoes).mockRejectedValue(new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão com o servidor.'));
    const { pessoa } = abrir();
    await pessoa.click(screen.getByRole('button', { name: 'Sair dos outros dispositivos' }));
    expect(await screen.findByText('Sem conexão com o servidor.')).toBeInTheDocument();
  });

  it('trocar a senha avisa que os outros dispositivos saíram', async () => {
    vi.mocked(authApi.trocarSenha).mockResolvedValue(undefined);
    const { pessoa } = abrir();
    await pessoa.type(screen.getByLabelText('Senha atual'), 'Senha1234');
    await pessoa.type(screen.getByLabelText(/^Nova senha/), 'NovaSenha123');
    await pessoa.type(screen.getByLabelText('Repita a nova senha'), 'NovaSenha123');
    await pessoa.click(screen.getByRole('button', { name: 'Alterar senha' }));
    expect(authApi.trocarSenha).toHaveBeenCalledWith('Senha1234', 'NovaSenha123');
    expect(await screen.findByText(/Os outros dispositivos conectados saíram da conta/)).toBeInTheDocument();
  });

  it('"Sair" encerra a sessão e volta ao início', async () => {
    const { pessoa, endereco } = abrir();
    await pessoa.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByText('Página inicial')).toBeInTheDocument();
    expect(endereco()).toBe('/');
    expect(screen.getByText('Você saiu da sua conta.')).toBeInTheDocument();
  });

  it('"Sair" sem conexão: avisa e continua na conta (antes, falhava em silêncio)', async () => {
    vi.mocked(authApi.sair).mockRejectedValue(new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão com o servidor.'));
    const { pessoa, endereco } = abrir();
    await pessoa.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByText('Não foi possível sair: Sem conexão com o servidor.')).toBeInTheDocument();
    expect(endereco()).toBe('/minha-conta');
  });
});
