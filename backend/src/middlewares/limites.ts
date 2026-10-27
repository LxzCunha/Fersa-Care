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

// O assistente usa bastante processamento (modelo de IA): perguntas por IP são limitadas.
export const limiteDoAssistente = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: env.emTeste ? 1000 : 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    erro: {
      codigo: 'MUITAS_PERGUNTAS',
      mensagem: 'Muitas perguntas em pouco tempo. Aguarde alguns minutos e tente de novo.',
    },
  },
});

export const limiteDeChamados = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.emTeste ? 1000 : 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    erro: {
      codigo: 'MUITOS_CHAMADOS',
      mensagem: 'Muitos chamados abertos a partir desta rede. Tente novamente mais tarde.',
    },
  },
});
