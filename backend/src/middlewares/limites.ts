import type { Request } from 'express';
import { rateLimit, type Options } from 'express-rate-limit';
import { env } from '../config/env.js';
import { log } from '../lib/log.js';

// Contadores na memória do processo: com várias instâncias, use um `store` compartilhado (rate-limit-redis).
const MINUTO = 60 * 1000;

interface Limite {
  janelaMinutos: number;
  limite: number;
  codigo: string;
  mensagem: string;
  somenteFalhas?: boolean;
  chave?: Options['keyGenerator'];
  ignorar?: Options['skip'];
}

export function criarLimite({ janelaMinutos, limite, codigo, mensagem, somenteFalhas, chave, ignorar }: Limite) {
  return rateLimit({
    windowMs: janelaMinutos * MINUTO,
    limit: limite,
    skipSuccessfulRequests: somenteFalhas ?? false,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(chave ? { keyGenerator: chave } : {}),
    ...(ignorar ? { skip: ignorar } : {}),
    handler: (req, res, _next, opcoes) => {
      log.warn({ limite: codigo, ip: req.ip, caminho: req.originalUrl }, `Limite de requisições atingido (${codigo})`);
      res.status(opcoes.statusCode).json({ erro: { codigo, mensagem } });
    },
  });
}

function emailDoLogin(req: Request): string | undefined {
  const email: unknown = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' && email.trim() !== '' ? email.trim().toLowerCase() : undefined;
}

// Só falhas contam: oficinas têm várias pessoas logando da mesma rede.
export const limiteDeLogin = criarLimite({
  janelaMinutos: 15,
  limite: env.emTeste ? 1000 : 10,
  somenteFalhas: true,
  codigo: 'MUITAS_TENTATIVAS',
  mensagem: 'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.',
});

/** Contra senhas testadas de muitos IPs. Chave = e-mail digitado, exista ou não, para não revelar cadastros. */
export function criarLimiteDeLoginPorConta(limite: number) {
  return criarLimite({
    janelaMinutos: 15,
    limite,
    somenteFalhas: true,
    chave: (req) => `conta:${emailDoLogin(req)}`,
    ignorar: (req) => emailDoLogin(req) === undefined,
    codigo: 'MUITAS_TENTATIVAS',
    mensagem: 'Muitas tentativas de login nesta conta. Aguarde 15 minutos e tente de novo.',
  });
}
export const limiteDeLoginPorConta = criarLimiteDeLoginPorConta(env.emTeste ? 1000 : 5);

export const limiteDeCadastro = criarLimite({
  janelaMinutos: 60,
  limite: env.emTeste ? 1000 : 5,
  codigo: 'MUITAS_SOLICITACOES',
  mensagem: 'Muitas solicitações de acesso a partir desta rede. Tente novamente mais tarde.',
});

export const limiteDoAssistente = criarLimite({
  janelaMinutos: 10,
  limite: env.emTeste ? 1000 : 30,
  codigo: 'MUITAS_PERGUNTAS',
  mensagem: 'Muitas perguntas em pouco tempo. Aguarde alguns minutos e tente de novo.',
});

export const limiteDeChamados = criarLimite({
  janelaMinutos: 60,
  limite: env.emTeste ? 1000 : 10,
  codigo: 'MUITOS_CHAMADOS',
  mensagem: 'Muitos chamados abertos a partir desta rede. Tente novamente mais tarde.',
});
