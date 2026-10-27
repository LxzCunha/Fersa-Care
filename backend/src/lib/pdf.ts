import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';

/** Fontes padrão do PDF (Helvetica, Times...) que o arquivo pode não trazer embutidas. */
const PASTA_PDFJS = path.dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));

/**
 * Abre um PDF do disco com o pdf.js (o mesmo leitor do Firefox), entrega o
 * documento para `usar` e libera a memória no fim. Usado para desenhar a
 * capa e para extrair o texto que vai para o assistente.
 */
export async function comPdf<T>(caminho: string, usar: (documento: PDFDocumentProxy) => Promise<T>): Promise<T> {
  // Importado só quando preciso: o pdf.js é grande e a API sobe sem ele.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const tarefa = pdfjs.getDocument({
    // Por endereço (e não lendo tudo para a memória): o pdf.js busca só os trechos que precisa.
    url: pathToFileURL(caminho).href,
    standardFontDataUrl: path.join(PASTA_PDFJS, 'standard_fonts') + path.sep,
    cMapUrl: path.join(PASTA_PDFJS, 'cmaps') + path.sep,
    cMapPacked: true,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });
  try {
    return await usar(await tarefa.promise);
  } finally {
    await tarefa.destroy();
  }
}
