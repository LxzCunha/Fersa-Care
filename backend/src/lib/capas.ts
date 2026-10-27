import { createCanvas, loadImage, type Canvas } from '@napi-rs/canvas';
import { caminhoDoArquivo, EXTENSOES_DE_IMAGEM, extensaoDe, gerarChave, gravarArquivo } from './armazenamento.js';
import { comPdf } from './pdf.js';

/** Em px: o dobro do cartão no desktop, para ficar nítida em telas retina. */
const LARGURA = 480;
const ALTURA_MAXIMA = 960;
const QUALIDADE_WEBP = 80;

export function temCapaAutomatica(nomeArquivo: string): boolean {
  const extensao = extensaoDe(nomeArquivo);
  return extensao === '.pdf' || EXTENSOES_DE_IMAGEM.includes(extensao);
}

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
    await pagina.render({ canvas, viewport }).promise;
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
