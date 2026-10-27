import { pino } from 'pino';
import { env } from '../config/env.js';
import { contextoAtual } from './contexto.js';

// Segredos nunca vão para o log: ao registrar um campo sensível novo, inclua-o no `redact`.
export const log = pino({
  level: env.LOG_NIVEL,
  base: { servico: 'fersa-care-api' },
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
      '*.senha',
      '*.senhaAtual',
      '*.novaSenha',
      '*.senhaHash',
      '*.token',
    ],
    censor: '[oculto]',
  },
  // Toda linha durante uma requisição leva o mesmo id devolvido em X-Request-Id.
  mixin(objeto) {
    const contexto = contextoAtual();
    return contexto && !('requisicaoId' in objeto) ? { requisicaoId: contexto.id } : {};
  },
  transport:
    env.LOG_FORMATO === 'legivel'
      ? { target: 'pino-pretty', options: { colorize: true, singleLine: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,servico' } }
      : undefined,
});

export function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}
