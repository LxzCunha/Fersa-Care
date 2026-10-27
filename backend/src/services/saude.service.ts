import { iaDisponivel } from '../lib/ia.js';
import { log, mensagemDoErro } from '../lib/log.js';
import * as saudeRepository from '../repositories/saude.repository.js';

/**
 * Prontidão para receber tráfego (readiness): o banco é indispensável; o
 * assistente (Ollama) não, então sem ele a API fica "degradada", mas pronta.
 */
export async function verificarProntidao() {
  const [banco, assistente] = await Promise.all([
    saudeRepository.bancoPronto().catch((erro: unknown) => {
      log.error({ motivo: mensagemDoErro(erro) }, 'Verificação de saúde: banco indisponível');
      return false;
    }),
    iaDisponivel(),
  ]);
  return {
    pronto: banco,
    status: !banco ? 'indisponivel' : assistente ? 'ok' : 'degradado',
    verificacoes: { banco: banco ? 'ok' : 'falhou', assistente: assistente ? 'ok' : 'indisponivel' },
  } as const;
}
