import type { LinhaDocumento, ProdutoResumo } from '../models/index.js';

/** As chaves do arquivo e da capa nunca saem da API: as rotas que entregam conferem a permissão. */
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
