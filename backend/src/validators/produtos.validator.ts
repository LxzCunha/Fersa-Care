import { z } from 'zod';
import { esquemaPaginacao, opcionalNaUrl, textoOpcional } from '../lib/validacao.js';
import { segmentoProduto } from '../models/index.js';

/** Medida no filtro da URL (?internoMin=20): número positivo, em mm. */
const medidaNaUrl = opcionalNaUrl(z.coerce.number('Informe um número.').nonnegative().max(100_000));

export const esquemaFiltrosProdutos = esquemaPaginacao.extend({
  busca: opcionalNaUrl(z.string().trim().max(120)),
  segmento: opcionalNaUrl(z.enum(segmentoProduto.enumValues)),
  categoriaId: opcionalNaUrl(z.uuid('Categoria inválida.')),
  internoMin: medidaNaUrl,
  internoMax: medidaNaUrl,
  externoMin: medidaNaUrl,
  externoMax: medidaNaUrl,
  larguraMin: medidaNaUrl,
  larguraMax: medidaNaUrl,
});

export const esquemaFiltrosProdutosAdmin = esquemaFiltrosProdutos.extend({
  ativo: opcionalNaUrl(z.stringbool()),
});

export type FiltrosProdutos = z.infer<typeof esquemaFiltrosProdutosAdmin>;

/** Medida opcional da peça: vazio vira null. */
function medida(rotulo: string, maximo: number) {
  return z
    .number({ error: `${rotulo}: informe um número.` })
    .positive(`${rotulo}: informe um valor maior que zero.`)
    .max(maximo, `${rotulo}: valor alto demais.`)
    .nullish()
    .transform((valor) => valor ?? null);
}

export const esquemaProduto = z.object({
  codigo: z
    .string({ error: 'Informe o código.' })
    .trim()
    .min(2, 'Informe o código da peça.')
    .max(40, 'Use no máximo 40 caracteres no código.')
    .transform((codigo) => codigo.toUpperCase()),
  nome: z.string({ error: 'Informe o nome.' }).trim().min(3, 'Informe o nome do produto.').max(160),
  segmento: z.enum(segmentoProduto.enumValues, { error: 'Escolha o segmento.' }),
  categoriaId: z
    .uuid('Categoria inválida.')
    .nullish()
    .transform((valor) => valor ?? null),
  descricao: textoOpcional(5000),
  aplicacoes: textoOpcional(5000),
  diametroInternoMm: medida('Ø interno', 100_000),
  diametroExternoMm: medida('Ø externo', 100_000),
  larguraMm: medida('Largura', 100_000),
  pesoKg: medida('Peso', 100_000),
  ativo: z.boolean().default(true),
  /** Na edição: true apaga a foto atual (quando nenhuma nova é enviada). */
  removerImagem: z.boolean().default(false),
});

export type DadosProduto = z.infer<typeof esquemaProduto>;
