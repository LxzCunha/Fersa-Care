import type { EventoDeAuditoria } from '../models/index.js';

export function paraEventoDto(evento: EventoDeAuditoria) {
  return {
    id: evento.id,
    acao: evento.acao,
    autor: evento.autorNome ? { id: evento.autorId, nome: evento.autorNome } : null,
    alvo:
      evento.alvoTipo && evento.alvoId
        ? { tipo: evento.alvoTipo, id: evento.alvoId, rotulo: evento.alvoRotulo ?? '' }
        : null,
    detalhes: evento.detalhes,
    ip: evento.ip,
    requisicaoId: evento.requisicaoId,
    criadoEm: evento.criadoEm,
  };
}

export type EventoDeAuditoriaDto = ReturnType<typeof paraEventoDto>;
