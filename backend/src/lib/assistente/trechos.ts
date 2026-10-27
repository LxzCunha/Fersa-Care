import fs from 'node:fs/promises';
import { caminhoDoArquivo, extensaoDe } from '../armazenamento.js';
import { comPdf } from '../pdf.js';

/** Em caracteres (~300 palavras). */
export const TAMANHO_DO_TRECHO = 1200;
export const SOBREPOSICAO = 200;

export interface PaginaDeTexto {
  /** Número da página no PDF; null para arquivos sem páginas (TXT, CSV). */
  pagina: number | null;
  texto: string;
}

export function temTextoLegivel(nomeArquivo: string): boolean {
  return ['.pdf', '.txt', '.csv'].includes(extensaoDe(nomeArquivo));
}

/** PDF escaneado (só imagem) volta vazio. */
export async function extrairTexto(chaveDoArquivo: string, nomeArquivo: string): Promise<PaginaDeTexto[]> {
  const caminho = caminhoDoArquivo(chaveDoArquivo);
  const extensao = extensaoDe(nomeArquivo);

  if (extensao === '.pdf') {
    return comPdf(caminho, async (documento) => {
      const paginas: PaginaDeTexto[] = [];
      for (let numero = 1; numero <= documento.numPages; numero++) {
        const pagina = await documento.getPage(numero);
        const conteudo = await pagina.getTextContent();
        const texto = conteudo.items
          .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
          .join('');
        paginas.push({ pagina: numero, texto: normalizarEspacos(texto) });
        pagina.cleanup();
      }
      return paginas.filter((pagina) => pagina.texto);
    });
  }

  if (extensao === '.txt' || extensao === '.csv') {
    const texto = normalizarEspacos(await fs.readFile(caminho, 'utf8'));
    return texto ? [{ pagina: null, texto }] : [];
  }

  return [];
}

export function normalizarEspacos(texto: string): string {
  return texto
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function dividirEmTrechos(texto: string, tamanho = TAMANHO_DO_TRECHO, sobreposicao = SOBREPOSICAO): string[] {
  const limpo = normalizarEspacos(texto);
  if (!limpo) return [];
  if (limpo.length <= tamanho) return [limpo];

  const pedacos = limpo
    .split(/\n{2,}/)
    .flatMap((paragrafo) => (paragrafo.length <= tamanho ? [paragrafo] : paragrafo.split(/(?<=[.!?;:])\s+/)))
    .flatMap((frase) => cortarEmPedacos(frase, tamanho));

  const trechos: string[] = [];
  let atual = '';
  for (const pedaco of pedacos) {
    const junto = atual ? `${atual}\n${pedaco}` : pedaco;
    if (junto.length <= tamanho) {
      atual = junto;
      continue;
    }
    trechos.push(atual);
    // Repete o final do anterior, sem a palavra que ficou cortada no começo.
    const repetido = atual.length > sobreposicao ? atual.slice(-sobreposicao).replace(/^\S*\s/, '') : atual;
    atual = `${repetido}\n${pedaco}`.length <= tamanho ? `${repetido}\n${pedaco}` : pedaco;
  }
  if (atual) trechos.push(atual);
  return trechos;
}

function cortarEmPedacos(texto: string, tamanho: number): string[] {
  if (texto.length <= tamanho) return [texto];
  const pedacos: string[] = [];
  for (let inicio = 0; inicio < texto.length; inicio += tamanho) pedacos.push(texto.slice(inicio, inicio + tamanho));
  return pedacos;
}

export interface DadosParaIndexar {
  titulo: string;
  tipo: string;
  descricao: string | null;
  codigosDasPecas: string[];
}

/** O 1º trecho é a ficha (acha até vídeos e links); os demais levam título e página para dizer de onde vieram. */
export function trechosDoDocumento(dados: DadosParaIndexar, paginas: PaginaDeTexto[]): string[] {
  const ficha = [
    `Documento: ${dados.titulo}`,
    `Tipo: ${dados.tipo}`,
    dados.codigosDasPecas.length > 0 ? `Peças relacionadas: ${dados.codigosDasPecas.join(', ')}` : '',
    dados.descricao ? `Descrição: ${dados.descricao}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const doConteudo = paginas.flatMap(({ pagina, texto }) =>
    dividirEmTrechos(texto).map(
      (trecho) => `Documento: ${dados.titulo}${pagina !== null ? ` (página ${pagina})` : ''}\n\n${trecho}`,
    ),
  );
  return [ficha, ...doConteudo];
}
