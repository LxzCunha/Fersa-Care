import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

/**
 * Senhas nunca são salvas em texto: guardamos só o hash bcrypt.
 * Custo 12 (2^12 rodadas, ~250 ms por login): caro para quem tenta adivinhar
 * senhas de um banco vazado, imperceptível para quem entra. Nos testes usamos
 * um custo menor para a suíte rodar rápido.
 */
export const CUSTO_DO_HASH = env.emTeste ? 4 : 12;

export function gerarHashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO_DO_HASH);
}

export function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

/**
 * Hash gravado com custo menor que o atual (ex.: antes de subirmos de 10 para
 * 12). No login, com a senha em mãos, ele é refeito com o custo novo.
 */
export function hashDesatualizado(hash: string, custo = CUSTO_DO_HASH): boolean {
  return bcrypt.getRounds(hash) < custo;
}

/**
 * Hash usado quando o e-mail informado no login não existe. Comparar a senha
 * com ele faz a resposta demorar o mesmo tempo nos dois casos, o que impede
 * descobrir quais e-mails têm cadastro medindo o tempo de resposta.
 */
let hashFalso: string | undefined;
export function hashParaComparacaoFalsa(): string {
  hashFalso ??= bcrypt.hashSync('senha-que-nao-existe', CUSTO_DO_HASH);
  return hashFalso;
}
