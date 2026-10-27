import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  customType,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { datas } from './colunas.js';
import { tipoDocumento, visibilidadeDocumento } from './enums.js';
import { usuarios } from './usuario.model.js';

const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

export const documentos = pgTable(
  'documentos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    titulo: varchar('titulo', { length: 200 }).notNull(),
    descricao: text('descricao'),
    tipo: tipoDocumento('tipo').notNull(),
    idioma: varchar('idioma', { length: 10 }).notNull().default('pt-BR'),
    visibilidade: visibilidadeDocumento('visibilidade').notNull().default('AUTENTICADO'),
    /** Rascunhos (false) ficam visíveis apenas para administradores. */
    publicado: boolean('publicado').notNull().default(true),

    /** Nome gerado na pasta de uploads; o original, usado no download, fica em arquivoNome. */
    arquivoChave: varchar('arquivo_chave', { length: 120 }),
    arquivoNome: varchar('arquivo_nome', { length: 255 }),
    arquivoMime: varchar('arquivo_mime', { length: 120 }),
    arquivoTamanho: bigint('arquivo_tamanho', { mode: 'number' }),
    urlExterna: text('url_externa'),

    capaChave: varchar('capa_chave', { length: 120 }),
    /** A capa foi enviada pelo admin: trocar o arquivo do documento não a substitui. */
    capaPersonalizada: boolean('capa_personalizada').notNull().default(false),

    /** Última indexação para o assistente; null = ainda na fila. */
    indexadoEm: timestamp('indexado_em', { withTimezone: true }),
    indexacaoErro: text('indexacao_erro'),

    criadoPor: uuid('criado_por').references(() => usuarios.id, { onDelete: 'set null' }),
    ...datas,

    // f_unaccent é criada à mão em drizzle/0000_extensoes.sql.
    busca: tsvector('busca').generatedAlwaysAs(
      sql`to_tsvector('portuguese'::regconfig, f_unaccent(coalesce(titulo, '') || ' ' || coalesce(descricao, '')))`,
    ),
  },
  (t) => [
    check(
      'documentos_arquivo_ou_link',
      sql`(${t.arquivoChave} IS NOT NULL) <> (${t.urlExterna} IS NOT NULL)`,
    ),
    index('documentos_busca_idx').using('gin', t.busca),
    index('documentos_visibilidade_idx').on(t.visibilidade, t.publicado),
  ],
);

export type Documento = typeof documentos.$inferSelect;
export type NovoDocumento = typeof documentos.$inferInsert;

export type LinhaDocumento = Omit<Documento, 'busca'>;
