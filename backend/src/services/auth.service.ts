import { paraUsuarioDto } from '../dtos/usuarios.dto.js';
import { conflito, ErroHttp, naoEncontrado, requisicaoInvalida } from '../lib/erros.js';
import { gerarToken, lerToken } from '../lib/jwt.js';
import { conferirSenha, gerarHashSenha, hashParaComparacaoFalsa } from '../lib/senha.js';
import type { UsuarioAutenticado } from '../models/index.js';
import * as usuariosRepository from '../repositories/usuarios.repository.js';
import type {
  DadosAtualizarPerfil,
  DadosSolicitarAcesso,
  DadosTrocarSenha,
} from '../validators/auth.validator.js';

/**
 * Descobre quem está chamando a partir do token de sessão (usado pelo middleware
 * identificarUsuario). O token guarda só o id: perfil e situação são lidos do
 * banco a cada requisição, então quem for desativado perde o acesso na hora.
 */
export async function usuarioDaSessao(token: string): Promise<UsuarioAutenticado | undefined> {
  const usuarioId = await lerToken(token);
  if (!usuarioId) return undefined;

  const usuario = await usuariosRepository.buscarPorId(usuarioId);
  if (!usuario || usuario.status !== 'ATIVO') return undefined;

  return { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil };
}

export async function entrar(email: string, senha: string) {
  const usuario = await usuariosRepository.buscarPorEmail(email);

  // Compara mesmo quando o e-mail não existe, para o tempo de resposta não denunciar isso.
  const senhaConfere = await conferirSenha(senha, usuario?.senhaHash ?? hashParaComparacaoFalsa());

  if (!usuario || !senhaConfere) {
    throw new ErroHttp(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.');
  }
  if (usuario.status === 'PENDENTE') {
    throw new ErroHttp(
      403,
      'CADASTRO_PENDENTE',
      'Seu cadastro ainda está em análise. Assim que um administrador aprovar, você poderá entrar.',
    );
  }
  if (usuario.status === 'INATIVO') {
    throw new ErroHttp(403, 'CONTA_INATIVA', 'Esta conta está desativada. Fale com o suporte FERSA.');
  }

  const atualizado = await usuariosRepository.registrarAcesso(usuario.id);
  const token = await gerarToken(usuario.id);
  return { usuario: paraUsuarioDto(atualizado ?? usuario), token };
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

export async function trocarSenha(usuarioId: string, dados: DadosTrocarSenha) {
  const usuario = await usuariosRepository.buscarPorId(usuarioId);
  if (!usuario) throw naoEncontrado('Usuário não encontrado.');

  if (!(await conferirSenha(dados.senhaAtual, usuario.senhaHash))) {
    throw requisicaoInvalida('A senha atual não confere.', [
      { campo: 'senhaAtual', mensagem: 'A senha atual não confere.' },
    ]);
  }

  await usuariosRepository.atualizar(usuarioId, { senhaHash: await gerarHashSenha(dados.novaSenha) });
}
