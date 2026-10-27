import { iaDisponivel } from '../lib/ia.js';
import { env } from '../config/env.js';
import { indexarPendentes } from '../services/indexacao.service.js';
import { pool } from './index.js';

// --todos refaz também os já indexados (ex.: depois de trocar o modelo de embeddings).
const todos = process.argv.includes('--todos');

try {
  if (!(await iaDisponivel())) {
    console.error(`❌ O Ollama não respondeu em ${env.OLLAMA_URL}. Abra o Ollama e baixe os modelos:`);
    console.error(`   ollama pull ${env.IA_MODELO_EMBEDDING} && ollama pull ${env.IA_MODELO_CHAT}`);
    process.exitCode = 1;
  } else {
    const inicio = Date.now();
    const { documentos, trechos, falhas } = await indexarPendentes({ todos });
    console.log(`✅ ${documentos} documento(s) indexado(s), ${trechos} trecho(s), em ${((Date.now() - inicio) / 1000).toFixed(1)} s.`);
    for (const falha of falhas) console.log(`   ⚠️  ${falha}`);
  }
} catch (erro) {
  console.error('❌ Falha ao indexar:', erro);
  process.exitCode = 1;
} finally {
  await pool.end();
}
