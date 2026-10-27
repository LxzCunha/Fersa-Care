import type { CookieOptions, NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { contextoAtual } from '../lib/contexto.js';
import { naoAutenticado, proibido } from '../lib/erros.js';
import type { UsuarioAutenticado } from '../models/index.js';
import { usuarioDaSessao } from '../services/auth.service.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- é assim que os tipos do Express aceitam campos novos (declaration merging)
  namespace Express {
    interface Request {
      /** Só para login válido de usuário ATIVO; undefined = visitante. */
      usuario?: UsuarioAutenticado;
    }
  }
}

export const NOME_COOKIE = 'fersa_sessao';

export function opcoesDoCookie(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SEGURO,
    path: '/',
    maxAge: Math.round(env.JWT_EXPIRACAO_HORAS * 3600 * 1000),
  };
}

function extrairToken(req: Request): string | undefined {
  const doCookie: unknown = req.cookies?.[NOME_COOKIE];
  if (typeof doCookie === 'string' && doCookie !== '') return doCookie;

  const cabecalho = req.headers.authorization;
  if (cabecalho?.startsWith('Bearer ')) return cabecalho.slice('Bearer '.length).trim();

  return undefined;
}

export async function identificarUsuario(req: Request, _res: Response, next: NextFunction) {
  const token = extrairToken(req);
  if (token) req.usuario = await usuarioDaSessao(token);
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

export function usuarioLogado(req: Request): UsuarioAutenticado {
  if (!req.usuario) throw naoAutenticado();
  return req.usuario;
}
