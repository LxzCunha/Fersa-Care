import { pino } from 'pino';
import { env } from '../config/env.js';
import { contextoAtual } from './contexto.js';

/**
 * Logger da aplicação (pino): um evento JSON por linha em produção, pronto para
 * ir a um agregador (Loki, CloudWatch, Datadog...). No desenvolvimento sai em
 * texto colorido; nos testes fica em silêncio.
 *
 * Cada linha registrada durante uma requisição leva o `requisicaoId`, o mesmo
 * devolvido ao cliente no cabeçalho X-Request-Id: com ele, o suporte acha
 * todos os eventos de uma chamada que deu erro.
 *
 * Segredos nunca vão para o log: cookies, Authorization e campos de senha/token
 * são trocados por "[oculto]" (redact).
 */
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
  mixin(objeto) {
    const contexto = contextoAtual();
    return contexto && !('requisicaoId' in objeto) ? { requisicaoId: contexto.id } : {};
  },
  transport:
    env.LOG_FORMATO === 'legivel'
      ? { target: 'pino-pretty', options: { colorize: true, singleLine: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,servico' } }
      : undefined,
});

/** Mensagem de um erro desconhecido, para logs curtos (o objeto completo vai em `err`). */
export function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}
