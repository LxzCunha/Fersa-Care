import type { Request } from 'express';
import { rateLimit, type Options } from 'express-rate-limit';
import { env } from '../config/env.js';
import { log } from '../lib/log.js';

/**
 * Limites de requisições nas rotas abertas a visitantes.
 *
 * Os contadores ficam na memória do processo: com mais de uma instância da API
 * atrás de um balanceador, cada uma conta separado. Para escalar, troque o
 * `store` por um compartilhado (ex.: rate-limit-redis); o resto não muda.
 */

const MINUTO = 60 * 1000;

interface Limite {
  janelaMinutos: number;
  limite: number;
  codigo: string;
  mensagem: string;
  /** Conta só as tentativas que deram erro (ex.: senha errada). */
  somenteFalhas?: boolean;
  chave?: Options['keyGenerator'];
  ignorar?: Options['skip'];
}

/** Monta o limitador com a resposta no formato de erro da API e um aviso no log quando estoura. */
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

/** E-mail digitado no login, normalizado (a conta exista ou não). */
function emailDoLogin(req: Request): string | undefined {
  const email: unknown = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' && email.trim() !== '' ? email.trim().toLowerCase() : undefined;
}

// Limita tentativas erradas por IP para dificultar ataques de força bruta na senha.
// Logins bem-sucedidos não contam (oficinas com várias pessoas na mesma rede).
export const limiteDeLogin = criarLimite({
  janelaMinutos: 15,
  limite: env.emTeste ? 1000 : 10,
  somenteFalhas: true,
  codigo: 'MUITAS_TENTATIVAS',
  mensagem: 'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.',
});

/**
 * Limite por conta, contra quem testa senhas de um mesmo e-mail a partir de
 * muitos IPs (o limite por IP não pega). A chave é o e-mail digitado, exista a
 * conta ou não, então a resposta não revela quais e-mails têm cadastro.
 * O bloqueio dura só a janela de 15 minutos, para não virar um jeito de travar
 * a conta de alguém por muito tempo.
 */
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

// O assistente usa bastante processamento (modelo de IA): perguntas por IP são limitadas.
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
