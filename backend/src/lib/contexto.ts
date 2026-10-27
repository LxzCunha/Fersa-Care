import { AsyncLocalStorage } from 'node:async_hooks';
import type { UsuarioAutenticado } from '../models/index.js';

// Fora de uma requisição (scripts, fila de indexação iniciada no boot) não há contexto.
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
