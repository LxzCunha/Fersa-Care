import fs from 'node:fs/promises';

/**
 * Confere se o conteúdo do arquivo é mesmo do tipo que a extensão diz, pelos
 * primeiros bytes (a "assinatura" ou magic number do formato). Sem isso, um
 * executável renomeado para "manual.pdf" seria aceito e distribuído aos
 * clientes pelo portal.
 *
 * Os formatos do Office novos (.docx, .xlsx, .pptx) são arquivos ZIP e os
 * antigos (.doc, .xls, .ppt) usam o contêiner OLE: a assinatura confirma o
 * contêiner, não o programa. Texto (.txt, .csv) não tem assinatura: basta não
 * ter bytes nulos, que só aparecem em arquivos binários (aceita UTF-8 e o
 * Latin-1 que o Excel usa ao exportar CSV no Brasil).
 */

type Conferencia = (inicio: Buffer) => boolean;

/** Bytes lidos do começo do arquivo. */
export const TAMANHO_DA_AMOSTRA = 4096;

const comecaCom =
  (...bytes: number[]): Conferencia =>
  (inicio) =>
    inicio.length >= bytes.length && bytes.every((byte, posicao) => inicio[posicao] === byte);

const textoNaPosicao =
  (texto: string, posicao = 0): Conferencia =>
  (inicio) =>
    inicio.subarray(posicao, posicao + texto.length).toString('latin1') === texto;

const semBytesNulos: Conferencia = (inicio) => !inicio.includes(0);
/** O cabeçalho %PDF- pode vir depois de alguns bytes (a especificação tolera até 1 KB). */
const pdf: Conferencia = (inicio) => inicio.subarray(0, 1024).includes('%PDF-');
const zip: Conferencia = (inicio) => textoNaPosicao('PK\x03\x04')(inicio) || textoNaPosicao('PK\x05\x06')(inicio);
const ole = comecaCom(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
const jpeg = comecaCom(0xff, 0xd8, 0xff);

/** Uma conferência para cada extensão aceita em lib/armazenamento.ts (o teste garante que nenhuma falta). */
const CONFERENCIAS: Record<string, Conferencia> = {
  '.pdf': pdf,
  '.png': comecaCom(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
  '.jpg': jpeg,
  '.jpeg': jpeg,
  '.webp': (inicio) => textoNaPosicao('RIFF')(inicio) && textoNaPosicao('WEBP', 8)(inicio),
  '.mp4': textoNaPosicao('ftyp', 4),
  '.webm': comecaCom(0x1a, 0x45, 0xdf, 0xa3),
  '.txt': semBytesNulos,
  '.csv': semBytesNulos,
  '.doc': ole,
  '.xls': ole,
  '.ppt': ole,
  '.docx': zip,
  '.xlsx': zip,
  '.pptx': zip,
  '.zip': zip,
};

export const EXTENSOES_CONFERIDAS = Object.keys(CONFERENCIAS);

/** Versão pura (recebe os primeiros bytes), usada nos testes. Extensão desconhecida nunca confere. */
export function inicioConfereComExtensao(inicio: Buffer, extensao: string): boolean {
  const conferir = CONFERENCIAS[extensao.toLowerCase()];
  return conferir ? conferir(inicio) : false;
}

export async function arquivoConfereComExtensao(caminho: string, extensao: string): Promise<boolean> {
  const arquivo = await fs.open(caminho, 'r');
  try {
    const { buffer, bytesRead } = await arquivo.read({
      buffer: Buffer.alloc(TAMANHO_DA_AMOSTRA),
      position: 0,
    });
    return inicioConfereComExtensao(buffer.subarray(0, bytesRead), extensao);
  } finally {
    await arquivo.close();
  }
}
