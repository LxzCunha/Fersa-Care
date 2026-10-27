import type { Request } from 'express';
import { z } from 'zod';
import { requisicaoInvalida } from './erros.js';

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
  // O bcrypt só considera os primeiros 72 bytes; letras acentuadas ocupam 2.
  .refine(
    (senha) => senha.length > 72 || Buffer.byteLength(senha, 'utf8') <= 72,
    'A senha ficou longa demais (com acentos, cabem menos de 72 caracteres).',
  )
  .regex(/[A-Za-z]/, 'A senha precisa ter pelo menos uma letra.')
  .regex(/\d/, 'A senha precisa ter pelo menos um número.');

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

export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, '\\$&');
}

export function termosDaBusca(busca: string): string[] {
  return busca.split(/\s+/).map((termo) => termo.trim()).filter(Boolean).slice(0, 6);
}

export function somenteLetrasENumeros(texto: string): string {
  return texto.replace(/[^\p{L}\p{N}]/gu, '');
}

export function lerDadosDoFormulario(req: Request): unknown {
  if (!req.is('multipart/form-data')) return req.body;

  const bruto: unknown = (req.body as { dados?: unknown } | undefined)?.dados;
  if (typeof bruto !== 'string') {
    throw requisicaoInvalida('Envie os campos do formulário em JSON no campo "dados".');
  }
  try {
    return JSON.parse(bruto);
  } catch {
    throw requisicaoInvalida('O campo "dados" não contém um JSON válido.');
  }
}
