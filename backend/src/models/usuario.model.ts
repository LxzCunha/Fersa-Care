import { sql } from 'drizzle-orm';
import { check, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { datas } from './colunas.js';
import { perfilUsuario, statusUsuario, type Perfil } from './enums.js';

export const usuarios = pgTable(
  'usuarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: varchar('nome', { length: 120 }).notNull(),
    email: varchar('email', { length: 180 }).notNull().unique('usuarios_email_unico'),
    senhaHash: text('senha_hash').notNull(),
    empresa: varchar('empresa', { length: 160 }),
    telefone: varchar('telefone', { length: 30 }),
    perfil: perfilUsuario('perfil').notNull().default('USUARIO'),
    status: statusUsuario('status').notNull().default('PENDENTE'),
    ultimoAcessoEm: timestamp('ultimo_acesso_em', { withTimezone: true }),
    /**
     * Vai no token de sessão e é conferida a cada requisição. Somar 1 derruba
     * todos os logins da conta (troca de senha, desativação, "sair dos outros
     * dispositivos"), mesmo com o JWT ainda dentro da validade.
     */
    versaoSessao: integer('versao_sessao').notNull().default(0),
    ...datas,
  },
  (t) => [check('usuarios_email_minusculo', sql`${t.email} = lower(${t.email})`)],
);

export type Usuario = typeof usuarios.$inferSelect;
export type NovoUsuario = typeof usuarios.$inferInsert;

/** Quem fez a requisição, quando há um login válido de um usuário ATIVO. */
export interface UsuarioAutenticado {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
}
