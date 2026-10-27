import { z } from 'zod';
import { esquemaPaginacao, opcionalNaUrl } from '../lib/validacao.js';
import { ACOES_DE_AUDITORIA, ALVOS_DE_AUDITORIA } from '../models/index.js';

export const GRUPOS_DE_AUDITORIA = ['ACESSOS', 'ALTERACOES'] as const;

export const esquemaFiltrosAuditoria = esquemaPaginacao.extend({
  busca: opcionalNaUrl(z.string().trim().max(120)),
  grupo: opcionalNaUrl(z.enum(GRUPOS_DE_AUDITORIA)),
  acao: opcionalNaUrl(z.enum(ACOES_DE_AUDITORIA)),
  autorId: opcionalNaUrl(z.uuid('Autor inválido.')),
  alvoTipo: opcionalNaUrl(z.enum(ALVOS_DE_AUDITORIA)),
  alvoId: opcionalNaUrl(z.uuid('Registro inválido.')),
});

export type FiltrosAuditoria = z.infer<typeof esquemaFiltrosAuditoria>;
