import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';

/** Limites de requisições por IP nas rotas abertas a visitantes. */

// Limita tentativas erradas por IP para dificultar ataques de força bruta na senha.
// Logins bem-sucedidos não contam (oficinas com várias pessoas na mesma rede).
export const limiteDeLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.emTeste ? 1000 : 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    erro: {
      codigo: 'MUITAS_TENTATIVAS',
      mensagem: 'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.',
    },
  },
});

export const limiteDeCadastro = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.emTeste ? 1000 : 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    erro: {
      codigo: 'MUITAS_SOLICITACOES',
      mensagem: 'Muitas solicitações de acesso a partir desta rede. Tente novamente mais tarde.',
    },
  },
});
