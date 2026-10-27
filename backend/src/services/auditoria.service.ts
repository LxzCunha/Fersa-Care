import type { Transacao } from '../db/index.js';
import { paraEventoDto } from '../dtos/auditoria.dto.js';
import { contextoAtual } from '../lib/contexto.js';
import { log } from '../lib/log.js';
import { montarPagina } from '../lib/validacao.js';
import { ACOES_DE_AUDITORIA, type AcaoDeAuditoria, type AlvoDeAuditoria } from '../models/index.js';
import * as auditoriaRepository from '../repositories/auditoria.repository.js';
import type { FiltrosAuditoria } from '../validators/auditoria.validator.js';

/**
 * Trilha de auditoria. Os services chamam `registrarEvento` depois de cada ação
 * que importa para a segurança (login, senha, mudanças feitas pelo admin).
 * Quem fez, o IP e o id da requisição vêm do contexto da requisição, então quem
 * chama informa só o que aconteceu.
 */

export interface Evento {
  acao: AcaoDeAuditoria;
  alvo?: { tipo: AlvoDeAuditoria; id: string; rotulo: string };
  detalhes?: Record<string, unknown>;
  /** Autor, quando ele ainda não está no contexto (ex.: o login que acabou de dar certo). */
  autor?: { id: string; nome: string };
}

/** Abas da tela: logins e senhas de um lado, mudanças no cadastro do outro. */
const ACESSOS: readonly AcaoDeAuditoria[] = [
  'LOGIN',
  'LOGIN_RECUSADO',
  'ACESSO_SOLICITADO',
  'SENHA_ALTERADA',
  'SESSOES_ENCERRADAS',
];
const ALTERACOES = ACOES_DE_AUDITORIA.filter((acao) => !ACESSOS.includes(acao));

/** Grava o evento. Com `tx`, entra na mesma transação da alteração (tudo ou nada). */
export async function registrarEvento(evento: Evento, tx?: Transacao): Promise<void> {
  const contexto = contextoAtual();
  const autor = evento.autor ?? contexto?.usuario;

  await auditoriaRepository.inserir(
    {
      acao: evento.acao,
      autorId: autor?.id ?? null,
      autorNome: autor?.nome ?? null,
      alvoTipo: evento.alvo?.tipo ?? null,
      alvoId: evento.alvo?.id ?? null,
      alvoRotulo: evento.alvo?.rotulo.slice(0, 300) ?? null,
      detalhes: evento.detalhes ?? {},
      ip: contexto?.ip ?? null,
      requisicaoId: contexto?.id ?? null,
    },
    tx,
  );

  // Também vai para o log, para quem monitora (SIEM) não depender do banco.
  log.info({ auditoria: { acao: evento.acao, autorId: autor?.id, alvo: evento.alvo } }, `Auditoria: ${evento.acao}`);
}

export async function listarEventos(filtros: FiltrosAuditoria) {
  const { grupo, ...resto } = filtros;
  const acoes = grupo === 'ACESSOS' ? ACESSOS : grupo === 'ALTERACOES' ? ALTERACOES : undefined;
  const { linhas, total } = await auditoriaRepository.listar({ ...resto, acoes });
  return montarPagina(linhas.map(paraEventoDto), total, filtros.pagina, filtros.porPagina);
}
