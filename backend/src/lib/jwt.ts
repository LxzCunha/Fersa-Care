import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';

const chave = new TextEncoder().encode(env.JWT_SEGREDO);
const EMISSOR = 'fersa-care';
const PUBLICO = 'fersa-care:sessao';

export interface DadosDaSessao {
  usuarioId: string;
  /** usuarios.versao_sessao na emissão: somar 1 a ela derruba os tokens antigos. */
  versao: number;
}

// Só id e versão: perfil e situação vêm do banco a cada requisição, para mudanças valerem na hora.
export async function gerarToken({ usuarioId, versao }: DadosDaSessao): Promise<string> {
  const agoraEmSegundos = Math.floor(Date.now() / 1000);
  return new SignJWT({ ver: versao })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(usuarioId)
    .setIssuer(EMISSOR)
    .setAudience(PUBLICO)
    .setIssuedAt(agoraEmSegundos)
    .setExpirationTime(agoraEmSegundos + Math.round(env.JWT_EXPIRACAO_HORAS * 3600))
    .sign(chave);
}

export async function lerToken(token: string): Promise<DadosDaSessao | null> {
  try {
    const { payload } = await jwtVerify(token, chave, {
      issuer: EMISSOR,
      audience: PUBLICO,
      // Só HS256: impede o truque do "alg: none".
      algorithms: ['HS256'],
      requiredClaims: ['sub', 'exp', 'iat'],
    });
    if (typeof payload.sub !== 'string' || typeof payload.ver !== 'number') return null;
    return { usuarioId: payload.sub, versao: payload.ver };
  } catch {
    return null;
  }
}
