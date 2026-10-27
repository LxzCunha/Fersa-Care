import { paraUsuarioDto } from '../dtos/usuarios.dto.js';
import { naoEncontrado, proibido } from '../lib/erros.js';
import { gerarHashSenha } from '../lib/senha.js';
import { montarPagina } from '../lib/validacao.js';
import { statusUsuario, type Perfil, type StatusUsuario, type Usuario } from '../models/index.js';
import * as documentosRepository from '../repositories/documentos.repository.js';
import * as usuariosRepository from '../repositories/usuarios.repository.js';
import type {
  DadosAtualizarUsuario,
  DadosCriarUsuario,
  FiltrosUsuarios,
} from '../validators/usuarios.validator.js';

/** Gestão de usuários pelo administrador (aprovar, criar, editar, desativar). */

export async function listarUsuarios(filtros: FiltrosUsuarios) {
  const { linhas, total } = await usuariosRepository.listar(filtros);

  // Quantidade por situação (para as abas da tela), respeitando busca e perfil.
  const linhasPorStatus = await usuariosRepository.contarPorStatus(filtros);
  const porStatus = Object.fromEntries(statusUsuario.enumValues.map((s) => [s, 0])) as Record<
    StatusUsuario,
    number
  >;
  for (const linha of linhasPorStatus) porStatus[linha.status] = linha.total;

  return {
    ...montarPagina(linhas.map(paraUsuarioDto), total, filtros.pagina, filtros.porPagina),
    porStatus,
  };
}

export async function detalharUsuario(id: string) {
  const usuario = await buscarOuFalhar(id);
  const documentosLiberados = await documentosRepository.restritosLiberadosPara(id);
  return { ...paraUsuarioDto(usuario), documentosLiberados };
}

export async function criarUsuario(dados: DadosCriarUsuario) {
  const { senha, ...resto } = dados;
  const usuario = await usuariosRepository.inserir({ ...resto, senhaHash: await gerarHashSenha(senha) });
  return paraUsuarioDto(usuario);
}

export async function atualizarUsuario(id: string, dados: DadosAtualizarUsuario, adminId: string) {
  const atual = await buscarOuFalhar(id);
  await protegerAcessoDeAdmin(atual, { perfil: dados.perfil, status: dados.status }, adminId);

  const { novaSenha, ...resto } = dados;
  const usuario = await usuariosRepository.atualizar(id, {
    ...resto,
    ...(novaSenha ? { senhaHash: await gerarHashSenha(novaSenha) } : {}),
  });
  return paraUsuarioDto(usuario!);
}

/** Aprovar (ATIVO), recusar/desativar (INATIVO) ou voltar para PENDENTE. */
export async function alterarStatus(id: string, status: StatusUsuario, adminId: string) {
  const atual = await buscarOuFalhar(id);
  await protegerAcessoDeAdmin(atual, { perfil: atual.perfil, status }, adminId);

  const usuario = await usuariosRepository.atualizar(id, { status });
  return paraUsuarioDto(usuario!);
}

export async function excluirUsuario(id: string, adminId: string) {
  const atual = await buscarOuFalhar(id);
  if (atual.id === adminId) throw proibido('Você não pode excluir a própria conta.');
  await protegerAcessoDeAdmin(atual, { perfil: 'USUARIO', status: 'INATIVO' }, adminId);
  await usuariosRepository.excluir(id);
}

// ─── Regras de proteção ─────────────────────────────────────────────────────

async function buscarOuFalhar(id: string): Promise<Usuario> {
  const usuario = await usuariosRepository.buscarPorId(id);
  if (!usuario) throw naoEncontrado('Usuário não encontrado.');
  return usuario;
}

/**
 * Evita que o portal fique sem administrador:
 * - ninguém tira o próprio acesso de admin (perfil ou situação);
 * - o último administrador ativo não pode ser rebaixado, desativado nem excluído.
 */
async function protegerAcessoDeAdmin(
  atual: { id: string; perfil: Perfil; status: StatusUsuario },
  novo: { perfil: Perfil; status: StatusUsuario },
  adminId: string,
) {
  const eraAdminAtivo = atual.perfil === 'ADMIN' && atual.status === 'ATIVO';
  const continuaAdminAtivo = novo.perfil === 'ADMIN' && novo.status === 'ATIVO';
  if (!eraAdminAtivo || continuaAdminAtivo) return;

  if (atual.id === adminId) {
    throw proibido('Você não pode remover o próprio acesso de administrador.');
  }

  if ((await usuariosRepository.contarOutrosAdminsAtivos(atual.id)) === 0) {
    throw proibido('O portal precisa de pelo menos um administrador ativo.');
  }
}
