import type { Request, Response } from 'express';
import { NOME_COOKIE, opcoesDoCookie, usuarioLogado } from '../middlewares/autenticacao.js';
import * as authService from '../services/auth.service.js';
import {
  esquemaAtualizarPerfil,
  esquemaEntrar,
  esquemaSolicitarAcesso,
  esquemaTrocarSenha,
} from '../validators/auth.validator.js';

/** Login e conta: /api/auth/... */

export async function entrar(req: Request, res: Response) {
  const { email, senha } = esquemaEntrar.parse(req.body);
  const { usuario, token } = await authService.entrar(email, senha);
  res.cookie(NOME_COOKIE, token, opcoesDoCookie());
  // O token também volta no corpo para clientes que não usam cookie (Swagger, app mobile).
  res.json({ usuario, token });
}

export function sair(_req: Request, res: Response) {
  const { maxAge: _ignorado, ...opcoes } = opcoesDoCookie();
  res.clearCookie(NOME_COOKIE, opcoes);
  res.status(204).end();
}

export async function solicitarAcesso(req: Request, res: Response) {
  const dados = esquemaSolicitarAcesso.parse(req.body);
  const usuario = await authService.solicitarAcesso(dados);
  res.status(201).json({
    usuario,
    mensagem: 'Solicitação enviada. Você poderá entrar assim que um administrador aprovar o cadastro.',
  });
}

/** Quem está logado agora. Visitantes recebem { usuario: null } (não é erro). */
export async function eu(req: Request, res: Response) {
  if (!req.usuario) {
    res.json({ usuario: null });
    return;
  }
  res.json({ usuario: await authService.obterPerfil(req.usuario.id) });
}

export async function atualizarPerfil(req: Request, res: Response) {
  const dados = esquemaAtualizarPerfil.parse(req.body);
  res.json({ usuario: await authService.atualizarPerfil(usuarioLogado(req).id, dados) });
}

/** Troca a senha. Os outros logins da conta caem; esta sessão recebe um cookie novo. */
export async function trocarSenha(req: Request, res: Response) {
  const dados = esquemaTrocarSenha.parse(req.body);
  const token = await authService.trocarSenha(usuarioLogado(req).id, dados);
  res.cookie(NOME_COOKIE, token, opcoesDoCookie());
  res.status(204).end();
}

export async function encerrarOutrasSessoes(req: Request, res: Response) {
  const token = await authService.encerrarOutrasSessoes(usuarioLogado(req).id);
  res.cookie(NOME_COOKIE, token, opcoesDoCookie());
  res.status(204).end();
}
