import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

// 12 ≈ 250 ms por login: caro para quem ataca um banco vazado; nos testes, 4 para a suíte ser rápida.
export const CUSTO_DO_HASH = env.emTeste ? 4 : 12;

export function gerarHashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO_DO_HASH);
}

export function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

export function hashDesatualizado(hash: string, custo = CUSTO_DO_HASH): boolean {
  return bcrypt.getRounds(hash) < custo;
}

// Para e-mail inexistente: comparar com ele iguala o tempo de resposta e não revela quem tem cadastro.
let hashFalso: string | undefined;
export function hashParaComparacaoFalsa(): string {
  hashFalso ??= bcrypt.hashSync('senha-que-nao-existe', CUSTO_DO_HASH);
  return hashFalso;
}
