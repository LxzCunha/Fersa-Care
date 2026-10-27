import type { AssistenteMensagem, Chamado } from '../models/index.js';

/** Formato das mensagens da conversa com o assistente nas respostas da API. */
export function paraMensagemDto(mensagem: AssistenteMensagem) {
  return {
    id: mensagem.id,
    papel: mensagem.papel,
    conteudo: mensagem.conteudo,
    fontes: mensagem.fontes,
    insatisfacao: mensagem.insatisfacao,
    criadoEm: mensagem.criadoEm,
  };
}

export function paraChamadoDto(chamado: Chamado) {
  return {
    id: chamado.id,
    numero: chamado.numero,
    nome: chamado.nome,
    email: chamado.email,
    telefone: chamado.telefone,
    resumo: chamado.resumo,
    status: chamado.status,
    observacao: chamado.observacao,
    /** Aberto por um cliente com login (false = visitante). */
    clienteCadastrado: chamado.usuarioId !== null,
    criadoEm: chamado.criadoEm,
    atualizadoEm: chamado.atualizadoEm,
  };
}

export type MensagemDto = ReturnType<typeof paraMensagemDto>;
export type ChamadoDto = ReturnType<typeof paraChamadoDto>;
