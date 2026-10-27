import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { executarNoContexto } from '../lib/contexto.js';
import { log } from '../lib/log.js';

/** Id vindo do proxy: só caracteres seguros para logs e cabeçalhos. */
const ID_ACEITO = /^[A-Za-z0-9._-]{8,64}$/;

// Atrás de proxy confiável, reaproveita o id dele para o mesmo id aparecer nos logs do proxy e da API.
export function identificarRequisicao(req: Request, res: Response, next: NextFunction) {
  const recebido = env.CONFIAR_PROXY > 0 ? req.get('x-request-id') : undefined;
  const id = recebido && ID_ACEITO.test(recebido) ? recebido : crypto.randomUUID();
  res.setHeader('X-Request-Id', id);
  executarNoContexto({ id, ip: req.ip }, next);
}

export function registrarRequisicao(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api/') || req.path.startsWith('/api/saude')) return next();

  const inicio = process.hrtime.bigint();
  res.on('finish', () => {
    const duracaoMs = Number((process.hrtime.bigint() - inicio) / 1_000_000n);
    const nivel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    log[nivel](
      {
        requisicaoId: res.getHeader('X-Request-Id'),
        requisicao: { metodo: req.method, caminho: req.originalUrl, status: res.statusCode, duracaoMs },
        usuarioId: req.usuario?.id,
        ip: req.ip,
      },
      `${req.method} ${req.originalUrl} → ${res.statusCode} (${duracaoMs} ms)`,
    );
  });
  next();
}
