import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';

const chave = new TextEncoder().encode(env.JWT_SEGREDO);
const EMISSOR = 'fersa-care';
/** Para quem o token vale: só para a sessão da API (um token feito para outra finalidade não serve aqui). */
const PUBLICO = 'fersa-care:sessao';

export interface DadosDaSessao {
  usuarioId: string;
  /** Versão da sessão da conta quando o token foi emitido (ver usuarios.versao_sessao). */
  versao: number;
}

/**
 * Gera o token de sessão (JWT assinado com HS256).
 * Guardamos só o id do usuário e a versão da sessão: perfil e situação são
 * lidos do banco a cada requisição, então desativar alguém ou trocar o perfil
 * vale na hora, e somar 1 à versão derruba os tokens antigos.
 */
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

/**
 * Valida assinatura, algoritmo (só HS256: impede o truque do "alg: none"),
 * emissor, público e validade. Retorna os dados da sessão ou null.
 */
export async function lerToken(token: string): Promise<DadosDaSessao | null> {
  try {
    const { payload } = await jwtVerify(token, chave, {
      issuer: EMISSOR,
      audience: PUBLICO,
      algorithms: ['HS256'],
      requiredClaims: ['sub', 'exp', 'iat'],
    });
    if (typeof payload.sub !== 'string' || typeof payload.ver !== 'number') return null;
    return { usuarioId: payload.sub, versao: payload.ver };
  } catch {
    return null;
  }
}
