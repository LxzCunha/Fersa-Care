import { paraChamadoDto, paraMensagemDto } from '../dtos/assistente.dto.js';
import { naoEncontrado } from '../lib/erros.js';
import { montarPagina } from '../lib/validacao.js';
import type { Chamado } from '../models/index.js';
import * as assistenteRepository from '../repositories/assistente.repository.js';
import * as chamadosRepository from '../repositories/chamados.repository.js';
import type { DadosAtualizarChamado, FiltrosChamados } from '../validators/chamados.validator.js';

/** Chamados de suporte técnico: abertura (pelo assistente) e acompanhamento (admin). */

export interface ContatoDoChamado {
  usuarioId: string | null;
  nome: string;
  email: string | null;
  telefone: string | null;
}

/**
 * Abre o chamado da conversa, com as perguntas da pessoa como resumo.
 * Cada conversa vira no máximo um chamado: se já existe, devolve o mesmo.
 */
export async function abrirChamadoDaConversa(conversaId: string, contato: ContatoDoChamado): Promise<Chamado> {
  const existente = await chamadosRepository.buscarPorConversa(conversaId);
  if (existente) return existente;

  const perguntas = (await assistenteRepository.listarMensagens(conversaId))
    .filter((mensagem) => mensagem.papel === 'USUARIO')
    .map((mensagem) => `• ${mensagem.conteudo}`);
  const resumo = perguntas.slice(-6).join('\n') || 'Pedido de atendimento pelo assistente técnico.';

  return chamadosRepository.inserir({ conversaId, ...contato, resumo });
}

export async function listarChamados(filtros: FiltrosChamados) {
  const { linhas, total, porStatus } = await chamadosRepository.listar(filtros);
  return { ...montarPagina(linhas.map(paraChamadoDto), total, filtros.pagina, filtros.porPagina), porStatus };
}

/** Chamado com a conversa inteira, para o técnico ler o que já foi respondido. */
export async function detalharChamado(id: string) {
  const chamado = await chamadosRepository.buscarPorId(id);
  if (!chamado) throw naoEncontrado('Chamado não encontrado.');
  const mensagens = chamado.conversaId ? await assistenteRepository.listarMensagens(chamado.conversaId) : [];
  return { ...paraChamadoDto(chamado), conversa: mensagens.map(paraMensagemDto) };
}

export async function atualizarChamado(id: string, dados: DadosAtualizarChamado) {
  const atualizado = await chamadosRepository.atualizar(id, dados);
  if (!atualizado) throw naoEncontrado('Chamado não encontrado.');
  return detalharChamado(id);
}
