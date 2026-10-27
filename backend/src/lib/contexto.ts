import { AsyncLocalStorage } from 'node:async_hooks';
import type { UsuarioAutenticado } from '../models/index.js';

/**
 * Contexto da requisição em andamento: id (para correlacionar os logs), IP e
 * quem está logado. Fica disponível em qualquer função chamada durante a
 * requisição, sem passar parâmetro de camada em camada (no Spring, seria o
 * SecurityContextHolder/MDC, que usam ThreadLocal).
 *
 * Usado pelos logs (cada linha leva o id da requisição) e pela trilha de
 * auditoria (quem fez, de qual IP). Fora de uma requisição (scripts, fila de
 * indexação iniciada no boot), não há contexto.
 */
export interface ContextoDaRequisicao {
  id: string;
  ip: string | undefined;
  usuario?: UsuarioAutenticado;
}

const armazenamento = new AsyncLocalStorage<ContextoDaRequisicao>();

export function executarNoContexto<T>(contexto: ContextoDaRequisicao, funcao: () => T): T {
  return armazenamento.run(contexto, funcao);
}

export function contextoAtual(): ContextoDaRequisicao | undefined {
  return armazenamento.getStore();
}
