import fs from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import { afterAll, beforeEach } from 'vitest';
import { env } from '../src/config/env.js';
import { db, pool } from '../src/db/index.js';
import { garantirQueEhBancoDeTeste } from './ambiente.js';

garantirQueEhBancoDeTeste(env.DATABASE_URL);

// Cada teste começa com o banco e a pasta de uploads vazios.
beforeEach(async () => {
  await db.execute(sql`
    TRUNCATE chamados, assistente_mensagens, assistente_conversas,
             documento_trechos, documento_visualizacoes, documento_acessos, documento_produtos,
             documentos, produtos, categorias, usuarios RESTART IDENTITY CASCADE
  `);
  await fs.rm(env.UPLOAD_DIR, { recursive: true, force: true });
  await fs.mkdir(env.UPLOAD_DIR, { recursive: true });
});

afterAll(async () => {
  await pool.end();
});
