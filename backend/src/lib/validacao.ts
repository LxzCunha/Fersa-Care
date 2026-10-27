import type { Request } from 'express';
import { z } from 'zod';
import { requisicaoInvalida } from './erros.js';

/**
 * Peças reutilizáveis de validação (Zod). Cada módulo monta seus esquemas
 * a partir daqui — o papel é parecido com as anotações do Bean Validation
 * (@NotBlank, @Email, @Size...) nos DTOs em Java.
 */

/** Converte "" em undefined: filtros vazios na URL (?tipo=) contam como "sem filtro". */
export function opcionalNaUrl<T extends z.ZodType>(esquema: T) {
  return z.preprocess((valor) => (valor === '' ? undefined : valor), esquema.optional());
}

export const esquemaPaginacao = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
});

export const esquemaParametroId = z.object({
  id: z.uuid('Identificador inválido.'),
});

export const campoEmail = z
  .string({ error: 'Informe o e-mail.' })
  .trim()
  .toLowerCase()
  .pipe(z.email('Informe um e-mail válido.').max(180, 'E-mail longo demais.'));

export const campoSenhaNova = z
  .string({ error: 'Informe a senha.' })
  .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
  .max(72, 'A senha pode ter no máximo 72 caracteres.')
  .regex(/[A-Za-z]/, 'A senha precisa ter pelo menos uma letra.')
  .regex(/\d/, 'A senha precisa ter pelo menos um número.');

/** Texto opcional: espaços nas pontas são removidos e texto vazio vira null. */
export function textoOpcional(maximo: number) {
  return z
    .string()
    .trim()
    .max(maximo, `Use no máximo ${maximo} caracteres.`)
    .nullish()
    .transform((valor) => (valor ? valor : null));
}

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
}

export function montarPagina<T>(itens: T[], total: number, pagina: number, porPagina: number): Pagina<T> {
  return {
    itens,
    total,
    pagina,
    porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}

/** Escapa % e _ para que o texto digitado não vire curinga dentro do ILIKE. */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, '\\$&');
}

/** Divide a busca em termos ("rolamento roda" → ["rolamento", "roda"]). */
export function termosDaBusca(busca: string): string[] {
  return busca.split(/\s+/).map((termo) => termo.trim()).filter(Boolean).slice(0, 6);
}

/** Remove espaços, hífens e pontos: "F-15.052" e "F 15052" viram "F15052". */
export function somenteLetrasENumeros(texto: string): string {
  return texto.replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * Formulários com arquivo chegam como multipart/form-data; nesse caso os
 * demais campos vêm em JSON no campo de texto "dados". Sem arquivo, o cliente
 * pode mandar o JSON direto no corpo.
 */
export function lerDadosDoFormulario(req: Request): unknown {
  if (!req.is('multipart/form-data')) return req.body;

  const bruto: unknown = req.body?.dados;
  if (typeof bruto !== 'string') {
    throw requisicaoInvalida('Envie os campos do formulário em JSON no campo "dados".');
  }
  try {
    return JSON.parse(bruto);
  } catch {
    throw requisicaoInvalida('O campo "dados" não contém um JSON válido.');
  }
}
