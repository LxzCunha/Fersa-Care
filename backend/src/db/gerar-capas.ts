import { gerarCapasPendentes } from '../services/documentos-admin.service.js';
import { pool } from './index.js';

/**
 * Gera a capa automática (1ª página do PDF ou a própria imagem) dos documentos
 * que ainda não têm uma, como os cadastrados antes das capas existirem.
 * Documentos novos ganham a capa no cadastro; rodar de novo é seguro.
 *
 * Uso: npm run capas:gerar
 */
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
