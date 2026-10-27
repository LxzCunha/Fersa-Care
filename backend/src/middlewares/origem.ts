import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { ErroHttp } from '../lib/erros.js';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Segunda barreira contra CSRF (além do sameSite), inclusive no login. Sem Origin nem Sec-Fetch-Site
// não é navegador (curl, apps, testes) e segue: CSRF depende do navegador mandar o cookie sozinho.
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
