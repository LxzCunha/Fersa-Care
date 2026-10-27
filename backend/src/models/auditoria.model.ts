import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/** O que pode ser registrado na trilha de auditoria. */
export const ACOES_DE_AUDITORIA = [
  // Acesso
  'LOGIN',
  'LOGIN_RECUSADO',
  'ACESSO_SOLICITADO',
  'SENHA_ALTERADA',
  'SESSOES_ENCERRADAS',
  // Administração
  'USUARIO_CRIADO',
  'USUARIO_ALTERADO',
  'USUARIO_STATUS_ALTERADO',
  'USUARIO_EXCLUIDO',
  'DOCUMENTO_CRIADO',
  'DOCUMENTO_ALTERADO',
  'DOCUMENTO_EXCLUIDO',
  'PRODUTO_CRIADO',
  'PRODUTO_ALTERADO',
  'PRODUTO_EXCLUIDO',
  'CATEGORIA_CRIADA',
  'CATEGORIA_ALTERADA',
  'CATEGORIA_EXCLUIDA',
  'CHAMADO_ALTERADO',
] as const;
export type AcaoDeAuditoria = (typeof ACOES_DE_AUDITORIA)[number];

export const ALVOS_DE_AUDITORIA = ['USUARIO', 'DOCUMENTO', 'PRODUTO', 'CATEGORIA', 'CHAMADO'] as const;
export type AlvoDeAuditoria = (typeof ALVOS_DE_AUDITORIA)[number];

/**
 * Trilha de auditoria: quem fez o quê, quando e de onde (logins, mudanças de
 * senha e toda alteração feita pelo administrador).
 *
 * A tabela só recebe INSERT: um gatilho no banco (migração
 * 0009_auditoria_somente_insercao) recusa UPDATE e DELETE, então nem um erro
 * da aplicação reescreve o histórico. Por isso não há chave estrangeira para
 * `usuarios`: excluir uma conta não pode mexer nos eventos dela. O nome do
 * autor e o rótulo do alvo são guardados como estavam no momento.
 */
export const eventosDeAuditoria = pgTable(
  'auditoria',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    acao: varchar('acao', { length: 40 }).$type<AcaoDeAuditoria>().notNull(),
    /** Quem fez. Nulo em ações de visitantes (login recusado, pedido de acesso). */
    autorId: uuid('autor_id'),
    autorNome: varchar('autor_nome', { length: 180 }),
    alvoTipo: varchar('alvo_tipo', { length: 20 }).$type<AlvoDeAuditoria>(),
    alvoId: uuid('alvo_id'),
    /** Título, nome ou código do alvo naquele momento. */
    alvoRotulo: varchar('alvo_rotulo', { length: 300 }),
    /** O que mudou (nomes dos campos, situação de/para, motivo da recusa...). Nunca valores de senha. */
    detalhes: jsonb('detalhes').$type<Record<string, unknown>>().notNull().default({}),
    ip: varchar('ip', { length: 64 }),
    requisicaoId: varchar('requisicao_id', { length: 64 }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('auditoria_criado_em_idx').on(t.criadoEm.desc()),
    index('auditoria_acao_idx').on(t.acao, t.criadoEm.desc()),
    index('auditoria_autor_idx').on(t.autorId, t.criadoEm.desc()),
    index('auditoria_alvo_idx').on(t.alvoTipo, t.alvoId),
  ],
);

export type EventoDeAuditoria = typeof eventosDeAuditoria.$inferSelect;
export type NovoEventoDeAuditoria = typeof eventosDeAuditoria.$inferInsert;
