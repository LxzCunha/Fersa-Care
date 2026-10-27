import { criarApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/index.js';
import { garantirPastaDeUploads } from './lib/armazenamento.js';

/** Ponto de entrada: confere o banco, prepara a pasta de uploads e abre a porta. */

async function conferirBanco() {
  try {
    await pool.query('select 1');
  } catch (erro) {
    console.error(
      '\n❌ Não foi possível conectar ao PostgreSQL.\n' +
        '   Confira se o banco está rodando (na raiz do projeto: docker compose up -d db)\n' +
        '   e se DATABASE_URL no arquivo .env está correta.\n',
    );
    console.error(erro instanceof Error ? erro.message : erro);
    process.exit(1);
  }

  const { rows } = await pool.query<{ tabela: string | null }>(
    "select to_regclass('public.documentos')::text as tabela",
  );
  if (!rows[0]?.tabela) {
    console.error('\n❌ As tabelas ainda não existem. Rode: npm run db:migrar (ou npm run setup)\n');
    process.exit(1);
  }
}

await conferirBanco();
await garantirPastaDeUploads();

const servidor = criarApp().listen(env.PORTA, () => {
  console.log(`✅ API FERSA CARE rodando em http://localhost:${env.PORTA}`);
  console.log(`   Documentação da API: http://localhost:${env.PORTA}/api/docs`);
  if (env.FRONTEND_DIST) console.log(`   Site: http://localhost:${env.PORTA}`);
});

// Encerramento gracioso: termina as requisições em andamento e fecha o banco.
function encerrar(sinal: string) {
  console.log(`\nRecebido ${sinal}, encerrando...`);
  servidor.close(() => {
    void pool.end().then(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => encerrar('SIGINT'));
process.on('SIGTERM', () => encerrar('SIGTERM'));
