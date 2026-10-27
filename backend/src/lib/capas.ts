import { createCanvas, loadImage, type Canvas } from '@napi-rs/canvas';
import { caminhoDoArquivo, EXTENSOES_DE_IMAGEM, extensaoDe, gerarChave, gravarArquivo } from './armazenamento.js';
import { comPdf } from './pdf.js';

/**
 * Capas dos documentos: miniaturas WebP mostradas nos cartões da biblioteca.
 * - PDF: a primeira página, desenhada com o pdf.js (o mesmo leitor do Firefox);
 * - imagem: a própria imagem, reduzida.
 * Vídeos, links e arquivos do Office não têm capa automática: o admin pode
 * enviar uma, e sem ela o site mostra uma capa com o ícone do tipo.
 */

/** Largura em pixels: o dobro do cartão no desktop, para ficar nítida em telas retina. */
const LARGURA = 480;
/** Corta imagens muito compridas (um banner vertical, por exemplo). */
const ALTURA_MAXIMA = 960;
const QUALIDADE_WEBP = 80;

export function temCapaAutomatica(nomeArquivo: string): boolean {
  const extensao = extensaoDe(nomeArquivo);
  return extensao === '.pdf' || EXTENSOES_DE_IMAGEM.includes(extensao);
}

/**
 * Gera a capa de um arquivo já gravado e devolve a chave dela.
 * Lança erro se o arquivo não puder ser lido (PDF corrompido, imagem inválida...).
 */
export async function gerarCapa(chaveDoArquivo: string, nomeArquivo: string): Promise<string> {
  const caminho = caminhoDoArquivo(chaveDoArquivo);
  const canvas =
    extensaoDe(nomeArquivo) === '.pdf' ? await desenharPrimeiraPagina(caminho) : await desenharImagem(caminho);

  const chave = gerarChave('capa.webp');
  await gravarArquivo(chave, await canvas.encode('webp', QUALIDADE_WEBP));
  return chave;
}

async function desenharPrimeiraPagina(caminho: string): Promise<Canvas> {
  return comPdf(caminho, async (documento) => {
    const pagina = await documento.getPage(1);
    const viewport = pagina.getViewport({ scale: LARGURA / pagina.getViewport({ scale: 1 }).width });

    const canvas = createCanvas(LARGURA, Math.min(Math.ceil(viewport.height), ALTURA_MAXIMA));
    const contexto = canvas.getContext('2d');
    contexto.fillStyle = '#ffffff'; // páginas sem fundo ficariam transparentes
    contexto.fillRect(0, 0, canvas.width, canvas.height);

    // O pdf.js espera um <canvas> do navegador; o do @napi-rs/canvas tem a mesma interface.
    await pagina.render({ canvas, viewport } as unknown as Parameters<typeof pagina.render>[0]).promise;
    return canvas;
  });
}

async function desenharImagem(caminho: string): Promise<Canvas> {
  const imagem = await loadImage(caminho);
  const escala = Math.min(1, LARGURA / imagem.width);
  const largura = Math.max(1, Math.round(imagem.width * escala));
  const altura = Math.max(1, Math.round(imagem.height * escala));

  const canvas = createCanvas(largura, Math.min(altura, ALTURA_MAXIMA));
  const contexto = canvas.getContext('2d');
  contexto.imageSmoothingQuality = 'high';
  contexto.drawImage(imagem, 0, 0, largura, altura);
  return canvas;
}
