import { pgEnum } from 'drizzle-orm/pg-core';

/** Tipos enumerados: viram ENUMs no PostgreSQL. */

/** ADMIN cadastra e gerencia tudo; USUARIO é o cliente com login. */
export const perfilUsuario = pgEnum('perfil_usuario', ['ADMIN', 'USUARIO']);

/** Quem pede acesso começa PENDENTE e só entra depois que um admin aprova. */
export const statusUsuario = pgEnum('status_usuario', ['PENDENTE', 'ATIVO', 'INATIVO']);

/**
 * Quem pode ver cada documento:
 * - PUBLICO: qualquer pessoa, mesmo sem login;
 * - AUTENTICADO: qualquer usuário com login ativo;
 * - RESTRITO: só os usuários escolhidos pelo administrador (tabela documento_acessos).
 * Administradores veem todos.
 */
export const visibilidadeDocumento = pgEnum('visibilidade_documento', [
  'PUBLICO',
  'AUTENTICADO',
  'RESTRITO',
]);

export const tipoDocumento = pgEnum('tipo_documento', [
  'MANUAL',
  'CATALOGO',
  'VIDEO',
  'TREINAMENTO',
  'FICHA_TECNICA',
  'BOLETIM',
  'OUTRO',
]);

export const segmentoProduto = pgEnum('segmento_produto', [
  'LEVE',
  'PESADA',
  'AGRICOLA',
  'INDUSTRIAL',
]);

export type Perfil = (typeof perfilUsuario.enumValues)[number];
export type StatusUsuario = (typeof statusUsuario.enumValues)[number];
export type Visibilidade = (typeof visibilidadeDocumento.enumValues)[number];
export type TipoDocumento = (typeof tipoDocumento.enumValues)[number];
export type Segmento = (typeof segmentoProduto.enumValues)[number];
