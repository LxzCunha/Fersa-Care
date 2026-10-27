import { gerarCapasPendentes } from '../services/documentos-admin.service.js';
import { pool } from './index.js';

try {
  const { pendentes, geradas } = await gerarCapasPendentes();
  console.log(`✅ Capas geradas: ${geradas} de ${pendentes} documento(s) com arquivo e sem capa.`);
  if (geradas < pendentes) {
    console.log('   Os demais são vídeos, arquivos do Office ou arquivos que não puderam ser lidos.');
  }
} catch (erro) {
  console.error('❌ Falha ao gerar as capas:', erro);
  process.exitCode = 1;
} finally {
  await pool.end();
}
