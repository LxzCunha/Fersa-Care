import type { LinhaDocumento, ProdutoResumo } from '../models/index.js';

/**
 * Formato público de um documento. As chaves internas do arquivo e da capa
 * (nomes no disco) nunca saem da API: o download é sempre feito por
 * /api/documentos/:id/arquivo e a capa por /api/documentos/:id/capa, que
 * conferem a permissão antes de entregar.
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
    /** `v` muda a cada edição: o navegador pode guardar a capa sem risco de mostrar uma antiga. */
    capaUrl: documento.capaChave
      ? `/api/documentos/${documento.id}/capa?v=${documento.atualizadoEm.getTime()}`
      : null,
    capaPersonalizada: documento.capaPersonalizada,
    produtos: produtosRelacionados,
    criadoEm: documento.criadoEm,
    atualizadoEm: documento.atualizadoEm,
  };
}

export type DocumentoDto = ReturnType<typeof paraDocumentoDto>;
