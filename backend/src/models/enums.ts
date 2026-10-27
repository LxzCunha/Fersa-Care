import { pgEnum } from 'drizzle-orm/pg-core';

// Espelhados à mão em frontend/src/api/tipos.ts.

export const perfilUsuario = pgEnum('perfil_usuario', ['ADMIN', 'USUARIO']);

/** Quem pede acesso começa PENDENTE e só entra depois que um admin aprova. */
export const statusUsuario = pgEnum('status_usuario', ['PENDENTE', 'ATIVO', 'INATIVO']);

/** RESTRITO: só os usuários liberados em documento_acessos. Admins veem todos. */
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

export const papelMensagem = pgEnum('papel_mensagem', ['USUARIO', 'ASSISTENTE']);

export const statusChamado = pgEnum('status_chamado', ['ABERTO', 'EM_ATENDIMENTO', 'RESOLVIDO']);

export type Perfil = (typeof perfilUsuario.enumValues)[number];
export type StatusUsuario = (typeof statusUsuario.enumValues)[number];
export type Visibilidade = (typeof visibilidadeDocumento.enumValues)[number];
export type TipoDocumento = (typeof tipoDocumento.enumValues)[number];
export type Segmento = (typeof segmentoProduto.enumValues)[number];
export type PapelMensagem = (typeof papelMensagem.enumValues)[number];
export type StatusChamado = (typeof statusChamado.enumValues)[number];
