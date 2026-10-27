import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';

const chave = new TextEncoder().encode(env.JWT_SEGREDO);
const EMISSOR = 'fersa-care';

/**
 * Gera o token de sessão (JWT assinado com HS256).
 * Guardamos apenas o id do usuário: perfil e situação são lidos do banco a cada
 * requisição, então desativar alguém ou trocar o perfil vale na hora.
 */
export async function gerarToken(usuarioId: string): Promise<string> {
  const agoraEmSegundos = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(usuarioId)
    .setIssuer(EMISSOR)
    .setIssuedAt(agoraEmSegundos)
    .setExpirationTime(agoraEmSegundos + Math.round(env.JWT_EXPIRACAO_HORAS * 3600))
    .sign(chave);
}

/** Valida assinatura e validade do token. Retorna o id do usuário ou null. */
export async function lerToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, chave, {
      issuer: EMISSOR,
      algorithms: ['HS256'],
    });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
