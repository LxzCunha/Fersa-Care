import os from 'node:os';
import path from 'node:path';

try {
  process.loadEnvFile();
} catch {
  // sem .env: usa as variáveis do ambiente
}

/** Banco SEPARADO, apagado e recriado a cada execução (troque com DATABASE_URL_TESTE). */
export const URL_BANCO_TESTE =
  process.env.DATABASE_URL_TESTE ?? 'postgres://fersa:fersa@localhost:5432/fersa_care_teste';

export const PASTA_UPLOADS_TESTE = path.join(os.tmpdir(), 'fersa-care-testes', 'uploads');

/** Trava de segurança: nunca limpar um banco cujo nome não indique que é de teste. */
export function garantirQueEhBancoDeTeste(url: string) {
  const nomeDoBanco = new URL(url).pathname.replace('/', '');
  if (!/test/i.test(nomeDoBanco)) {
    throw new Error(
      `Os testes apagam o banco "${nomeDoBanco}". Use um banco com "teste" no nome (DATABASE_URL_TESTE).`,
    );
  }
}
