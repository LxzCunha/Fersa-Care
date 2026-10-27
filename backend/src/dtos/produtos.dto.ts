import type { LinhaProduto } from '../models/index.js';

/**
 * Formato público de uma peça do catálogo. A chave interna da foto (nome no
 * disco) não sai da API: a imagem é entregue por /api/produtos/:id/imagem.
 * O `?v=` muda sempre que a peça é editada, para o navegador não mostrar uma
 * foto antiga do cache.
 */
export function paraProdutoDto(produto: LinhaProduto) {
  return {
    id: produto.id,
    codigo: produto.codigo,
    nome: produto.nome,
    segmento: produto.segmento,
    categoria: produto.categoria,
    descricao: produto.descricao,
    aplicacoes: produto.aplicacoes,
    diametroInternoMm: produto.diametroInternoMm,
    diametroExternoMm: produto.diametroExternoMm,
    larguraMm: produto.larguraMm,
    pesoKg: produto.pesoKg,
    imagemUrl: produto.imagemChave
      ? `/api/produtos/${produto.id}/imagem?v=${produto.atualizadoEm.getTime()}`
      : null,
    ativo: produto.ativo,
    criadoEm: produto.criadoEm,
    atualizadoEm: produto.atualizadoEm,
  };
}

export type ProdutoDto = ReturnType<typeof paraProdutoDto>;
