import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  customType,
  index,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { datas } from './colunas.js';
import { tipoDocumento, visibilidadeDocumento } from './enums.js';
import { usuarios } from './usuario.model.js';

/** Coluna de busca textual do PostgreSQL (full-text search). */
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

    // O conteúdo é um arquivo enviado OU um link externo (YouTube, SharePoint...).
    /** Nome do arquivo dentro da pasta de uploads (gerado pelo sistema). */
    arquivoChave: varchar('arquivo_chave', { length: 120 }),
    /** Nome original do arquivo, usado no download. */
    arquivoNome: varchar('arquivo_nome', { length: 255 }),
    arquivoMime: varchar('arquivo_mime', { length: 120 }),
    arquivoTamanho: bigint('arquivo_tamanho', { mode: 'number' }),
    urlExterna: text('url_externa'),

    criadoPor: uuid('criado_por').references(() => usuarios.id, { onDelete: 'set null' }),
    ...datas,

    /**
     * Vetor de busca calculado pelo próprio PostgreSQL a partir do título e da
     * descrição (em português e sem acentos). A função f_unaccent é criada na
     * primeira migração (drizzle/0000_extensoes.sql).
     */
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

/** Um documento como vem das consultas, sem a coluna interna de busca. */
export type LinhaDocumento = Omit<Documento, 'busca'>;
