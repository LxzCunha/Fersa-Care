import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

/**
 * Senhas nunca são salvas em texto: guardamos só o hash bcrypt.
 * Nos testes usamos um custo menor para a suíte rodar rápido.
 */
const CUSTO = env.emTeste ? 4 : 10;

export function gerarHashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO);
}

export function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

/**
 * Hash usado quando o e-mail informado no login não existe. Comparar a senha
 * com ele faz a resposta demorar o mesmo tempo nos dois casos, o que impede
 * descobrir quais e-mails têm cadastro medindo o tempo de resposta.
 */
let hashFalso: string | undefined;
export function hashParaComparacaoFalsa(): string {
  hashFalso ??= bcrypt.hashSync('senha-que-nao-existe', CUSTO);
  return hashFalso;
}
