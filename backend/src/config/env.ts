import crypto from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';

/**
 * Variáveis de ambiente da API, validadas na inicialização.
 *
 * Se algo estiver faltando ou com formato errado, a API nem sobe e mostra
 * exatamente qual variável corrigir — melhor do que falhar no meio de uma requisição.
 */

// Carrega o arquivo .env (se existir). Variáveis já definidas no ambiente têm prioridade.
try {
  process.loadEnvFile();
} catch {
  // Sem arquivo .env: seguimos com as variáveis do ambiente.
}

const SEGREDO_DE_EXEMPLO = 'troque-este-valor-por-um-segredo-com-mais-de-32-caracteres';

const textoOpcional = z
  .string()
  .optional()
  .transform((valor) => (valor && valor.trim() !== '' ? valor.trim() : undefined));

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORTA: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'Defina DATABASE_URL (veja o arquivo .env.example).'),
  JWT_SEGREDO: z
    .string()
    .min(32, 'JWT_SEGREDO precisa ter pelo menos 32 caracteres.')
    .optional(),
  JWT_EXPIRACAO_HORAS: z.coerce.number().positive().default(8),
  COOKIE_SEGURO: z.stringbool().default(false),
  UPLOAD_DIR: z.string().default('./uploads'),
  UPLOAD_LIMITE_MB: z.coerce.number().positive().default(200),
  FRONTEND_DIST: textoOpcional,
  CONFIAR_PROXY: z.coerce.number().int().min(0).default(0),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  console.error('\n❌ Configuração inválida no .env:\n');
  console.error(z.prettifyError(resultado.error));
  process.exit(1);
}

const dados = resultado.data;
const emProducao = dados.NODE_ENV === 'production';

if (emProducao && (!dados.JWT_SEGREDO || dados.JWT_SEGREDO === SEGREDO_DE_EXEMPLO)) {
  console.error('\n❌ Em produção, defina JWT_SEGREDO com um valor aleatório e secreto.\n');
  process.exit(1);
}

function segredoTemporario(): string {
  console.warn(
    '⚠️  JWT_SEGREDO não definido: usando um segredo temporário. ' +
      'Os logins deixam de valer sempre que a API reinicia.',
  );
  return crypto.randomBytes(48).toString('base64url');
}

export const env = {
  ...dados,
  JWT_SEGREDO: dados.JWT_SEGREDO ?? segredoTemporario(),
  UPLOAD_DIR: path.resolve(dados.UPLOAD_DIR),
  FRONTEND_DIST: dados.FRONTEND_DIST ? path.resolve(dados.FRONTEND_DIST) : undefined,
  emProducao,
  emTeste: dados.NODE_ENV === 'test',
} as const;
