import { paraUsuarioDto } from '../dtos/usuarios.dto.js';
import { conflito, ErroHttp, naoEncontrado, requisicaoInvalida } from '../lib/erros.js';
import { gerarToken, lerToken } from '../lib/jwt.js';
import { conferirSenha, gerarHashSenha, hashDesatualizado, hashParaComparacaoFalsa } from '../lib/senha.js';
import type { Usuario, UsuarioAutenticado } from '../models/index.js';
import * as usuariosRepository from '../repositories/usuarios.repository.js';
import type {
  DadosAtualizarPerfil,
  DadosSolicitarAcesso,
  DadosTrocarSenha,
} from '../validators/auth.validator.js';
import { registrarEvento } from './auditoria.service.js';

/**
 * Descobre quem está chamando a partir do token de sessão (usado pelo middleware
 * identificarUsuario). O token guarda só o id e a versão da sessão: perfil e
 * situação são lidos do banco a cada requisição, então quem for desativado
 * perde o acesso na hora, e um token de antes de uma troca de senha não vale mais.
 */
export async function usuarioDaSessao(token: string): Promise<UsuarioAutenticado | undefined> {
  const sessao = await lerToken(token);
  if (!sessao) return undefined;

  const usuario = await usuariosRepository.buscarPorId(sessao.usuarioId);
  if (!usuario || usuario.status !== 'ATIVO' || usuario.versaoSessao !== sessao.versao) return undefined;

  return { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil };
}

function tokenDe(usuario: Usuario) {
  return gerarToken({ usuarioId: usuario.id, versao: usuario.versaoSessao });
}

export async function entrar(email: string, senha: string) {
  const usuario = await usuariosRepository.buscarPorEmail(email);

  // Compara mesmo quando o e-mail não existe, para o tempo de resposta não denunciar isso.
  const senhaConfere = await conferirSenha(senha, usuario?.senhaHash ?? hashParaComparacaoFalsa());

  if (!usuario || !senhaConfere) {
    await recusarLogin(email, usuario, 'CREDENCIAIS_INVALIDAS');
    throw new ErroHttp(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.');
  }
  if (usuario.status === 'PENDENTE') {
    await recusarLogin(email, usuario, 'CADASTRO_PENDENTE');
    throw new ErroHttp(
      403,
      'CADASTRO_PENDENTE',
      'Seu cadastro ainda está em análise. Assim que um administrador aprovar, você poderá entrar.',
    );
  }
  if (usuario.status === 'INATIVO') {
    await recusarLogin(email, usuario, 'CONTA_INATIVA');
    throw new ErroHttp(403, 'CONTA_INATIVA', 'Esta conta está desativada. Fale com o suporte FERSA.');
  }

  // Senha certa em mãos: se o hash é de um custo antigo, refaz com o atual.
  const novoHash = hashDesatualizado(usuario.senhaHash) ? await gerarHashSenha(senha) : undefined;
  const atualizado = (await usuariosRepository.registrarAcesso(usuario.id, novoHash)) ?? usuario;

  await registrarEvento({
    acao: 'LOGIN',
    autor: { id: usuario.id, nome: usuario.nome },
    alvo: alvoDoUsuario(usuario),
  });
  return { usuario: paraUsuarioDto(atualizado), token: await tokenDe(atualizado) };
}

/** Registra a tentativa recusada (o e-mail digitado ajuda a reconhecer ataques de adivinhação). */
function recusarLogin(email: string, usuario: Usuario | undefined, motivo: string) {
  return registrarEvento({
    acao: 'LOGIN_RECUSADO',
    alvo: usuario ? alvoDoUsuario(usuario) : undefined,
    detalhes: { email, motivo },
  });
}

function alvoDoUsuario(usuario: Pick<Usuario, 'id' | 'nome' | 'email'>) {
  return { tipo: 'USUARIO' as const, id: usuario.id, rotulo: `${usuario.nome} <${usuario.email}>` };
}

/** Cadastro feito pelo próprio cliente: entra como PENDENTE e aguarda aprovação. */
export async function solicitarAcesso(dados: DadosSolicitarAcesso) {
  const existente = await usuariosRepository.buscarPorEmail(dados.email);
  if (existente) throw conflito('Já existe um cadastro com este e-mail.');

  const novo = await usuariosRepository.inserir({
    nome: dados.nome,
    email: dados.email,
    senhaHash: await gerarHashSenha(dados.senha),
    empresa: dados.empresa,
    telefone: dados.telefone,
    perfil: 'USUARIO',
    status: 'PENDENTE',
  });

  await registrarEvento({ acao: 'ACESSO_SOLICITADO', alvo: alvoDoUsuario(novo), detalhes: { empresa: novo.empresa } });
  return paraUsuarioDto(novo);
}

export async function obterPerfil(usuarioId: string) {
  const usuario = await usuariosRepository.buscarPorId(usuarioId);
  if (!usuario) throw naoEncontrado('Usuário não encontrado.');
  return paraUsuarioDto(usuario);
}

export async function atualizarPerfil(usuarioId: string, dados: DadosAtualizarPerfil) {
  const usuario = await usuariosRepository.atualizar(usuarioId, dados);
  if (!usuario) throw naoEncontrado('Usuário não encontrado.');
  return paraUsuarioDto(usuario);
}

/**
 * Troca a senha e derruba os logins nos outros dispositivos (quem trocou a
 * senha por desconfiança não fica com uma sessão roubada aberta). Devolve um
 * token novo para a sessão atual continuar.
 */
export async function trocarSenha(usuarioId: string, dados: DadosTrocarSenha): Promise<string> {
  const usuario = await usuariosRepository.buscarPorId(usuarioId);
  if (!usuario) throw naoEncontrado('Usuário não encontrado.');

  if (!(await conferirSenha(dados.senhaAtual, usuario.senhaHash))) {
    throw requisicaoInvalida('A senha atual não confere.', [
      { campo: 'senhaAtual', mensagem: 'A senha atual não confere.' },
    ]);
  }

  const atualizado = await usuariosRepository.atualizar(
    usuarioId,
    { senhaHash: await gerarHashSenha(dados.novaSenha) },
    { encerrarSessoes: true },
  );
  await registrarEvento({ acao: 'SENHA_ALTERADA', alvo: alvoDoUsuario(usuario) });
  return tokenDe(atualizado!);
}

/** "Sair dos outros dispositivos": invalida todos os tokens e devolve um novo para a sessão atual. */
export async function encerrarOutrasSessoes(usuarioId: string): Promise<string> {
  const usuario = await usuariosRepository.encerrarSessoes(usuarioId);
  if (!usuario) throw naoEncontrado('Usuário não encontrado.');
  await registrarEvento({ acao: 'SESSOES_ENCERRADAS', alvo: alvoDoUsuario(usuario) });
  return tokenDe(usuario);
}
