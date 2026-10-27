import type { LinhaProduto } from '../models/index.js';

/** A chave da foto não sai da API; o `?v=` muda a cada edição para o navegador não mostrar foto antiga. */
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
