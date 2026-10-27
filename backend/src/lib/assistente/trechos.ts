import fs from 'node:fs/promises';
import { caminhoDoArquivo, extensaoDe } from '../armazenamento.js';
import { comPdf } from '../pdf.js';

/**
 * Preparação dos documentos para o assistente: extrair o texto e dividi-lo em
 * trechos do tamanho certo para a busca por similaridade.
 */

/** Tamanho alvo de cada trecho, em caracteres (~300 palavras). */
export const TAMANHO_DO_TRECHO = 1200;
/** Quanto do fim de um trecho se repete no começo do próximo (para não cortar uma ideia ao meio). */
export const SOBREPOSICAO = 200;

export interface PaginaDeTexto {
  /** Número da página no PDF; null para arquivos sem páginas (TXT, CSV). */
  pagina: number | null;
  texto: string;
}

/** Formatos de onde o assistente consegue ler texto. Os outros entram só com título e descrição. */
export function temTextoLegivel(nomeArquivo: string): boolean {
  return ['.pdf', '.txt', '.csv'].includes(extensaoDe(nomeArquivo));
}

/** Texto de um arquivo já gravado, página por página. PDF escaneado (só imagem) volta vazio. */
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

/** Junta espaços repetidos e linhas em branco em excesso, preservando os parágrafos. */
export function normalizarEspacos(texto: string): string {
  return texto
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Divide o texto em trechos de até TAMANHO_DO_TRECHO caracteres, quebrando de
 * preferência entre parágrafos e frases, com SOBREPOSICAO caracteres repetidos
 * entre um trecho e o seguinte.
 */
export function dividirEmTrechos(texto: string, tamanho = TAMANHO_DO_TRECHO, sobreposicao = SOBREPOSICAO): string[] {
  const limpo = normalizarEspacos(texto);
  if (!limpo) return [];
  if (limpo.length <= tamanho) return [limpo];

  // Pedaços pequenos: parágrafos; parágrafo grande vira frases; frase enorme é cortada.
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
    // O próximo trecho começa repetindo o final do anterior.
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

/**
 * Todos os trechos de um documento, prontos para gerar os embeddings:
 * - o primeiro descreve o documento (título, tipo, peças, descrição), assim
 *   até vídeos e links, que não têm texto, são encontrados pelo assistente;
 * - os demais trazem o conteúdo do arquivo, cada um com o título e a página no
 *   começo (o trecho sozinho precisa dizer de onde veio).
 */
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
