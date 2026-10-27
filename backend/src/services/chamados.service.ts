import { paraChamadoDto, paraMensagemDto } from '../dtos/assistente.dto.js';
import { camposAlterados } from '../lib/diferencas.js';
import { naoEncontrado } from '../lib/erros.js';
import { montarPagina } from '../lib/validacao.js';
import type { Chamado } from '../models/index.js';
import * as assistenteRepository from '../repositories/assistente.repository.js';
import * as chamadosRepository from '../repositories/chamados.repository.js';
import type { DadosAtualizarChamado, FiltrosChamados } from '../validators/chamados.validator.js';
import { registrarEvento } from './auditoria.service.js';

export interface ContatoDoChamado {
  usuarioId: string | null;
  nome: string;
  email: string | null;
  telefone: string | null;
}

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

export async function detalharChamado(id: string) {
  const chamado = await chamadosRepository.buscarPorId(id);
  if (!chamado) throw naoEncontrado('Chamado não encontrado.');
  const mensagens = chamado.conversaId ? await assistenteRepository.listarMensagens(chamado.conversaId) : [];
  return { ...paraChamadoDto(chamado), conversa: mensagens.map(paraMensagemDto) };
}

export async function atualizarChamado(id: string, dados: DadosAtualizarChamado) {
  const atual = await chamadosRepository.buscarPorId(id);
  if (!atual) throw naoEncontrado('Chamado não encontrado.');
  await chamadosRepository.atualizar(id, dados);
  await registrarEvento({
    acao: 'CHAMADO_ALTERADO',
    alvo: { tipo: 'CHAMADO', id, rotulo: `Chamado nº ${atual.numero} · ${atual.nome}` },
    detalhes: {
      campos: camposAlterados(atual, dados),
      ...(atual.status !== dados.status ? { status: { de: atual.status, para: dados.status } } : {}),
    },
  });
  return detalharChamado(id);
}
