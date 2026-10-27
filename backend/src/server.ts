import { criarApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/index.js';
import { garantirPastaDeUploads } from './lib/armazenamento.js';
import { iaDisponivel } from './lib/ia.js';
import { log, mensagemDoErro } from './lib/log.js';
import { indexarPendentes } from './services/indexacao.service.js';

async function conferirBanco() {
  try {
    await pool.query('select 1');
  } catch (erro) {
    log.fatal(
      { motivo: mensagemDoErro(erro) },
      'Não foi possível conectar ao PostgreSQL. Confira se o banco está rodando ' +
        '(na raiz do projeto: docker compose up -d db) e se DATABASE_URL no .env está correta.',
    );
    process.exit(1);
  }

  const { rows } = await pool.query<{ tabela: string | null }>(
    "select to_regclass('public.documentos')::text as tabela",
  );
  if (!rows[0]?.tabela) {
    log.fatal('As tabelas ainda não existem. Rode: npm run db:migrar (ou npm run setup)');
    process.exit(1);
  }
}

await conferirBanco();
await garantirPastaDeUploads();

const servidor = criarApp().listen(env.PORTA, () => {
  log.info(
    { porta: env.PORTA, ambiente: env.NODE_ENV },
    `API FERSA CARE rodando em http://localhost:${env.PORTA} (documentação em /api/docs${env.FRONTEND_DIST ? ', site em /' : ''})`,
  );
  void prepararAssistente();
});

async function prepararAssistente() {
  if (!env.IA_INDEXAR_AO_SALVAR) return;
  if (!(await iaDisponivel())) {
    log.warn({ ollama: env.OLLAMA_URL }, 'Ollama fora do ar: o assistente responde só com o encaminhamento ao suporte.');
    return;
  }
  const { documentos, trechos, falhas } = await indexarPendentes();
  if (documentos > 0) log.info({ documentos, trechos }, 'Assistente: documentos pendentes indexados');
  for (const falha of falhas) log.warn({ motivo: falha }, 'Indexação falhou');
}

// Erro que escapou de todo tratamento: registra e encerra (o orquestrador sobe de novo, em estado limpo).
process.on('uncaughtException', (erro) => {
  log.fatal({ err: erro }, 'Erro não tratado; encerrando');
  process.exit(1);
});
process.on('unhandledRejection', (motivo) => {
  log.fatal({ err: motivo }, 'Promise rejeitada sem tratamento; encerrando');
  process.exit(1);
});

function encerrar(sinal: string) {
  log.info({ sinal }, 'Encerrando...');
  servidor.close(() => {
    void pool.end().then(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => encerrar('SIGINT'));
process.on('SIGTERM', () => encerrar('SIGTERM'));
