import type { CookieOptions, NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { contextoAtual } from '../lib/contexto.js';
import { naoAutenticado, proibido } from '../lib/erros.js';
import type { UsuarioAutenticado } from '../models/index.js';
import { usuarioDaSessao } from '../services/auth.service.js';

/**
 * Os três níveis de acesso do portal:
 *
 *   Visitante  → req.usuario fica undefined
 *   Usuário    → req.usuario.perfil === 'USUARIO'
 *   Admin      → req.usuario.perfil === 'ADMIN'
 *
 * `identificarUsuario` roda em todas as rotas da API e só descobre quem está
 * chamando. Quem bloqueia são `exigirLogin` e `exigirAdmin`, colocados nas
 * rotas que precisam deles (parecido com as regras do Spring Security).
 */

// Acrescenta o campo `usuario` ao tipo Request do Express.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- é assim que os tipos do Express aceitam campos novos (declaration merging)
  namespace Express {
    interface Request {
      /** Preenchido quando a requisição traz um login válido de um usuário ATIVO. */
      usuario?: UsuarioAutenticado;
    }
  }
}

export const NOME_COOKIE = 'fersa_sessao';

/**
 * O navegador guarda o token num cookie httpOnly: o JavaScript da página não
 * consegue lê-lo (protege contra roubo por XSS) e `sameSite: 'lax'` impede que
 * outros sites façam requisições de alteração usando a sessão do usuário.
 */
export function opcoesDoCookie(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SEGURO,
    path: '/',
    maxAge: Math.round(env.JWT_EXPIRACAO_HORAS * 3600 * 1000),
  };
}

/** Lê o token do cookie (site) ou do cabeçalho Authorization: Bearer (apps e testes). */
function extrairToken(req: Request): string | undefined {
  const doCookie: unknown = req.cookies?.[NOME_COOKIE];
  if (typeof doCookie === 'string' && doCookie !== '') return doCookie;

  const cabecalho = req.headers.authorization;
  if (cabecalho?.startsWith('Bearer ')) return cabecalho.slice('Bearer '.length).trim();

  return undefined;
}

export async function identificarUsuario(req: Request, _res: Response, next: NextFunction) {
  const token = extrairToken(req);
  // Usuário desativado depois do login perde o acesso imediatamente (ver usuarioDaSessao).
  if (token) req.usuario = await usuarioDaSessao(token);
  // Logs e auditoria passam a saber quem está chamando.
  const contexto = contextoAtual();
  if (contexto) contexto.usuario = req.usuario;
  next();
}

export function exigirLogin(req: Request, _res: Response, next: NextFunction) {
  if (!req.usuario) throw naoAutenticado();
  next();
}

export function exigirAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.usuario) throw naoAutenticado();
  if (req.usuario.perfil !== 'ADMIN') throw proibido('Área restrita a administradores.');
  next();
}

/** Atalho para usar dentro de rotas que já passaram por exigirLogin/exigirAdmin. */
export function usuarioLogado(req: Request): UsuarioAutenticado {
  if (!req.usuario) throw naoAutenticado();
  return req.usuario;
}
