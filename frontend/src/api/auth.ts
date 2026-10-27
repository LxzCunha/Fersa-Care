import { api } from './cliente';
import type { Usuario } from './tipos';

export function obterUsuarioAtual() {
  return api<{ usuario: Usuario | null }>('/auth/eu').then((resposta) => resposta.usuario);
}

export function entrar(email: string, senha: string) {
  return api<{ usuario: Usuario }>('/auth/entrar', { metodo: 'POST', corpo: { email, senha } }).then(
    (resposta) => resposta.usuario,
  );
}

export function sair() {
  return api<void>('/auth/sair', { metodo: 'POST' });
}

export interface DadosSolicitacao {
  nome: string;
  email: string;
  senha: string;
  empresa: string;
  telefone: string;
}

export function solicitarAcesso(dados: DadosSolicitacao) {
  return api<{ mensagem: string }>('/auth/solicitar-acesso', { metodo: 'POST', corpo: dados });
}

export function atualizarPerfil(dados: { nome: string; empresa: string; telefone: string }) {
  return api<{ usuario: Usuario }>('/auth/eu', { metodo: 'PUT', corpo: dados }).then((r) => r.usuario);
}

export function trocarSenha(senhaAtual: string, novaSenha: string) {
  return api<void>('/auth/eu/senha', { metodo: 'PUT', corpo: { senhaAtual, novaSenha } });
}

/** Encerra a sessão em todos os outros dispositivos; este navegador recebe um login novo. */
export function encerrarOutrasSessoes() {
  return api<void>('/auth/eu/encerrar-outras-sessoes', { metodo: 'POST' });
}
