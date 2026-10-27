import { z } from 'zod';
import { opcionalNaUrl, textoOpcional } from '../lib/validacao.js';

export const esquemaFiltrosCategorias = z.object({
  busca: opcionalNaUrl(z.string().trim().max(120)),
});

export type FiltrosCategorias = z.infer<typeof esquemaFiltrosCategorias>;

export const esquemaCategoria = z.object({
  nome: z
    .string({ error: 'Informe o nome.' })
    .trim()
    .min(3, 'Informe o nome da categoria.')
    .max(120, 'Use no máximo 120 caracteres no nome.'),
  descricao: textoOpcional(2000),
});

export type DadosCategoria = z.infer<typeof esquemaCategoria>;
