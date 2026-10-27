import { z } from 'zod';
import { campoEmail, esquemaPaginacao, opcionalNaUrl, textoOpcional } from '../lib/validacao.js';
import { statusChamado } from '../models/index.js';

export const esquemaFiltrosChamados = esquemaPaginacao.extend({
  busca: opcionalNaUrl(z.string().trim().max(120)),
  status: opcionalNaUrl(z.enum(statusChamado.enumValues)),
});

export type FiltrosChamados = z.infer<typeof esquemaFiltrosChamados>;

export const esquemaAtualizarChamado = z.object({
  status: z.enum(statusChamado.enumValues, { error: 'Situação inválida.' }),
  observacao: textoOpcional(5000),
});

/** Contato opcional aqui: quem tem login usa o da conta; o service exige nome e contato do visitante. */
export const esquemaAbrirChamado = z.object({
  conversaId: z.uuid('Conversa inválida.'),
  nome: textoOpcional(120),
  email: z.union([campoEmail, z.literal(''), z.null()]).optional().transform((valor) => valor || null),
  telefone: textoOpcional(30),
});

export type DadosAbrirChamado = z.infer<typeof esquemaAbrirChamado>;
export type DadosAtualizarChamado = z.infer<typeof esquemaAtualizarChamado>;
