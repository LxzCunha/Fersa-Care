import type { LinhaDocumento, ProdutoResumo } from '../models/index.js';

/**
 * Formato público de um documento. A chave interna do arquivo (nome no disco)
 * nunca sai da API: o download é sempre feito por /api/documentos/:id/arquivo,
 * que confere a permissão antes de entregar.
 */
export function paraDocumentoDto(documento: LinhaDocumento, produtosRelacionados: ProdutoResumo[]) {
  return {
    id: documento.id,
    titulo: documento.titulo,
    descricao: documento.descricao,
    tipo: documento.tipo,
    idioma: documento.idioma,
    visibilidade: documento.visibilidade,
    publicado: documento.publicado,
    origem: documento.urlExterna ? ('LINK' as const) : ('ARQUIVO' as const),
    arquivo: documento.arquivoNome
      ? {
          nome: documento.arquivoNome,
          mime: documento.arquivoMime,
          tamanho: documento.arquivoTamanho,
        }
      : null,
    urlExterna: documento.urlExterna,
    produtos: produtosRelacionados,
    criadoEm: documento.criadoEm,
    atualizadoEm: documento.atualizadoEm,
  };
}

export type DocumentoDto = ReturnType<typeof paraDocumentoDto>;
