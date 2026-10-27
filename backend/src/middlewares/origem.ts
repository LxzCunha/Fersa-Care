import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { ErroHttp } from '../lib/erros.js';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Segunda barreira contra CSRF (a primeira é o cookie `sameSite: 'lax'`):
 * requisições que alteram dados só são aceitas quando o navegador diz que vêm
 * do próprio portal.
 *
 * - Com o cabeçalho Origin (todo navegador atual manda em POST/PUT/PATCH/DELETE),
 *   ele precisa ser a origem da própria API ou uma de ORIGENS_CONFIAVEIS.
 * - Sem Origin, o Sec-Fetch-Site não pode ser "cross-site".
 * - Sem nenhum dos dois, não é um navegador (curl, apps, testes): segue, pois
 *   CSRF depende de um navegador mandando o cookie da vítima sozinho.
 *
 * Vale também para o login, o que impede um site de logar a vítima numa conta
 * do atacante (login CSRF).
 */
export function conferirOrigem(req: Request, _res: Response, next: NextFunction) {
  if (METODOS_SEGUROS.has(req.method)) return next();

  const origem = req.get('origin');
  if (origem !== undefined) {
    if (origemConfiavel(origem, req)) return next();
    throw recusada();
  }
  if (req.get('sec-fetch-site') === 'cross-site') throw recusada();
  next();
}

function origemConfiavel(origem: string, req: Request): boolean {
  if (env.ORIGENS_CONFIAVEIS.includes(origem)) return true;
  try {
    // `req.host` já considera o X-Forwarded-Host quando a API está atrás de um proxy confiável.
    return new URL(origem).host === req.host;
  } catch {
    return false; // "null" (iframe isolado, arquivo local) ou valor malformado
  }
}

function recusada() {
  return new ErroHttp(403, 'ORIGEM_NAO_PERMITIDA', 'Requisição recusada: ela não partiu do portal FERSA CARE.');
}
