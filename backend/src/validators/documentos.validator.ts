import { z } from 'zod';
import { esquemaPaginacao, opcionalNaUrl, textoOpcional } from '../lib/validacao.js';
import { segmentoProduto, tipoDocumento, visibilidadeDocumento } from '../models/index.js';

export const IDIOMAS = ['pt-BR', 'es', 'en'] as const;

export const esquemaFiltrosDocumentos = esquemaPaginacao.extend({
  busca: opcionalNaUrl(z.string().trim().max(120)),
  tipo: opcionalNaUrl(z.enum(tipoDocumento.enumValues)),
  segmento: opcionalNaUrl(z.enum(segmentoProduto.enumValues)),
  produtoId: opcionalNaUrl(z.uuid('Produto inválido.')),
  idioma: opcionalNaUrl(z.enum(IDIOMAS)),
});

export const esquemaFiltrosDocumentosAdmin = esquemaFiltrosDocumentos.extend({
  visibilidade: opcionalNaUrl(z.enum(visibilidadeDocumento.enumValues)),
  publicado: opcionalNaUrl(z.stringbool()),
});

export type FiltrosDocumentos = z.infer<typeof esquemaFiltrosDocumentosAdmin>;

export const esquemaDocumento = z
  .object({
    titulo: z
      .string({ error: 'Informe o título.' })
      .trim()
      .min(3, 'O título precisa ter pelo menos 3 caracteres.')
      .max(200, 'Use no máximo 200 caracteres no título.'),
    descricao: textoOpcional(5000),
    tipo: z.enum(tipoDocumento.enumValues, { error: 'Escolha o tipo do documento.' }),
    idioma: z.enum(IDIOMAS, { error: 'Idioma inválido.' }).default('pt-BR'),
    visibilidade: z.enum(visibilidadeDocumento.enumValues, {
      error: 'Escolha quem pode ver o documento.',
    }),
    publicado: z.boolean().default(true),
    origem: z.enum(['ARQUIVO', 'LINK'], { error: 'Escolha entre enviar um arquivo ou usar um link.' }),
    urlExterna: z
      .url({ protocol: /^https?$/, error: 'Informe um link que comece com http:// ou https://.' })
      .max(2000, 'Link longo demais.')
      .nullish(),
    produtoIds: z.array(z.uuid('Produto inválido.')).max(100).default([]),
    /** Só vale quando a visibilidade é RESTRITO. */
    usuarioIds: z.array(z.uuid('Usuário inválido.')).max(2000).default([]),
    /** Volta da capa enviada pelo admin para a automática. */
    removerCapa: z.boolean().default(false),
  })
  .superRefine((dados, contexto) => {
    if (dados.origem === 'LINK' && !dados.urlExterna) {
      contexto.addIssue({
        code: 'custom',
        path: ['urlExterna'],
        message: 'Informe o link do conteúdo.',
      });
    }
  });

export type DadosDocumento = z.infer<typeof esquemaDocumento>;
