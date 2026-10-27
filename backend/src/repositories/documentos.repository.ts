import { and, asc, count, desc, eq, exists, inArray, notInArray, or, sql, type SQL } from 'drizzle-orm';
import { db, type Transacao } from '../db/index.js';
import { escaparLike, somenteLetrasENumeros, termosDaBusca } from '../lib/validacao.js';
import {
  documentoAcessos,
  documentoProdutos,
  documentos,
  produtos,
  usuarios,
  type LinhaDocumento,
  type NovoDocumento,
  type ProdutoResumo,
  type UsuarioAutenticado,
  type Visibilidade,
} from '../models/index.js';
import type { FiltrosDocumentos } from '../validators/documentos.validator.js';
import { contarSe } from './sql.js';
import { condicaoDeVisibilidade } from './visibilidade.js';

/**
 * Acesso à tabela documentos e às tabelas ligadas a ela (produtos e lista de acesso).
 *
 * Toda leitura que devolve documentos recebe o usuário da requisição e aplica
 * condicaoDeVisibilidade: o service diz PARA QUEM é a consulta e a regra de
 * quem vê o quê fica só no repository.
 */

/** Colunas lidas nas consultas de documentos (não traz o vetor de busca). */
const colunasDoDocumento = {
  id: documentos.id,
  titulo: documentos.titulo,
  descricao: documentos.descricao,
  tipo: documentos.tipo,
  idioma: documentos.idioma,
  visibilidade: documentos.visibilidade,
  publicado: documentos.publicado,
  arquivoChave: documentos.arquivoChave,
  arquivoNome: documentos.arquivoNome,
  arquivoMime: documentos.arquivoMime,
  arquivoTamanho: documentos.arquivoTamanho,
  urlExterna: documentos.urlExterna,
  criadoPor: documentos.criadoPor,
  criadoEm: documentos.criadoEm,
  atualizadoEm: documentos.atualizadoEm,
};

interface OpcoesDeAcesso {
  /** Só tem efeito para administradores. */
  incluirRascunhos?: boolean;
}

// ─── Busca ──────────────────────────────────────────────────────────────────

function consultaTextual(texto: string): SQL {
  return sql`websearch_to_tsquery('portuguese', f_unaccent(${texto}))`;
}

/**
 * Um documento entra no resultado quando:
 * - a busca textual do PostgreSQL (com radicais em português: "rolamentos"
 *   encontra "rolamento") bate com título/descrição; ou
 * - cada termo digitado aparece no título, na descrição ou em um produto
 *   relacionado (código, nome ou aplicação). Para códigos, espaços e hífens
 *   são ignorados: "F15052" encontra "F 15052".
 */
function condicaoDeBusca(busca: string | undefined): SQL | undefined {
  const termos = termosDaBusca(busca ?? '');
  if (termos.length === 0) return undefined;

  const porTermo = termos.map((termo) => {
    const padrao = `%${escaparLike(termo)}%`;
    const codigo = somenteLetrasENumeros(termo);

    const produtoRelacionadoCorresponde = exists(
      db
        .select({ um: sql`1` })
        .from(documentoProdutos)
        .innerJoin(produtos, eq(produtos.id, documentoProdutos.produtoId))
        .where(
          and(
            eq(documentoProdutos.documentoId, documentos.id),
            or(
              codigo
                ? sql`regexp_replace(${produtos.codigo}, '[^[:alnum:]]', '', 'g') ILIKE ${`%${escaparLike(codigo)}%`}`
                : undefined,
              sql`f_unaccent(${produtos.nome}) ILIKE f_unaccent(${padrao})`,
              sql`f_unaccent(coalesce(${produtos.aplicacoes}, '')) ILIKE f_unaccent(${padrao})`,
            ),
          ),
        ),
    );

    return or(
      sql`f_unaccent(${documentos.titulo}) ILIKE f_unaccent(${padrao})`,
      sql`f_unaccent(coalesce(${documentos.descricao}, '')) ILIKE f_unaccent(${padrao})`,
      produtoRelacionadoCorresponde,
    );
  });

  return or(
    sql`${documentos.busca} @@ ${consultaTextual(termos.join(' '))}`,
    and(...porTermo),
  );
}

function condicoesDosFiltros(filtros: Partial<FiltrosDocumentos>): (SQL | undefined)[] {
  return [
    condicaoDeBusca(filtros.busca),
    filtros.tipo ? eq(documentos.tipo, filtros.tipo) : undefined,
    filtros.idioma ? eq(documentos.idioma, filtros.idioma) : undefined,
    filtros.visibilidade ? eq(documentos.visibilidade, filtros.visibilidade) : undefined,
    filtros.publicado !== undefined ? eq(documentos.publicado, filtros.publicado) : undefined,
    filtros.produtoId
      ? exists(
          db
            .select({ um: sql`1` })
            .from(documentoProdutos)
            .where(
              and(
                eq(documentoProdutos.documentoId, documentos.id),
                eq(documentoProdutos.produtoId, filtros.produtoId),
              ),
            ),
        )
      : undefined,
    filtros.segmento
      ? exists(
          db
            .select({ um: sql`1` })
            .from(documentoProdutos)
            .innerJoin(produtos, eq(produtos.id, documentoProdutos.produtoId))
            .where(
              and(
                eq(documentoProdutos.documentoId, documentos.id),
                eq(produtos.segmento, filtros.segmento),
              ),
            ),
        )
      : undefined,
  ];
}

// ─── Leitura ────────────────────────────────────────────────────────────────

/** Uma página dos documentos que `usuario` pode ver, com os filtros aplicados. */
export async function listar(
  filtros: Partial<FiltrosDocumentos> & { pagina: number; porPagina: number },
  usuario: UsuarioAutenticado | undefined,
  opcoes: OpcoesDeAcesso = {},
): Promise<{ linhas: LinhaDocumento[]; total: number }> {
  const onde = and(condicaoDeVisibilidade(usuario, opcoes), ...condicoesDosFiltros(filtros));
  const termos = termosDaBusca(filtros.busca ?? '');

  const ordem: SQL[] = [];
  if (termos.length > 0) {
    ordem.push(desc(sql`ts_rank(${documentos.busca}, ${consultaTextual(termos.join(' '))})`));
  }
  ordem.push(desc(documentos.atualizadoEm));

  const [contagem] = await db.select({ total: count() }).from(documentos).where(onde);
  const linhas = await db
    .select(colunasDoDocumento)
    .from(documentos)
    .where(onde)
    .orderBy(...ordem)
    .limit(filtros.porPagina)
    .offset((filtros.pagina - 1) * filtros.porPagina);

  return { linhas, total: contagem?.total ?? 0 };
}

/** O documento, se existir e `usuario` puder vê-lo. */
export async function buscarPorId(
  id: string,
  usuario: UsuarioAutenticado | undefined,
  opcoes: OpcoesDeAcesso = {},
): Promise<LinhaDocumento | undefined> {
  const [documento] = await db
    .select(colunasDoDocumento)
    .from(documentos)
    .where(and(eq(documentos.id, id), condicaoDeVisibilidade(usuario, opcoes)))
    .limit(1);
  return documento;
}

/** Existe um documento publicado com este id (independente de quem pode vê-lo)? */
export async function existePublicado(id: string): Promise<boolean> {
  const [documento] = await db
    .select({ id: documentos.id })
    .from(documentos)
    .where(and(eq(documentos.id, id), eq(documentos.publicado, true)))
    .limit(1);
  return documento !== undefined;
}

/** Quantos documentos `usuario` pode ver, agrupados por tipo. */
export function contarPorTipo(usuario: UsuarioAutenticado | undefined) {
  return db
    .select({ tipo: documentos.tipo, total: count() })
    .from(documentos)
    .where(condicaoDeVisibilidade(usuario))
    .groupBy(documentos.tipo);
}

/** Quantos documentos publicados têm esta visibilidade. */
export async function contarPublicados(visibilidade: Visibilidade): Promise<number> {
  const [contagem] = await db
    .select({ total: count() })
    .from(documentos)
    .where(and(eq(documentos.publicado, true), eq(documentos.visibilidade, visibilidade)));
  return contagem?.total ?? 0;
}

/** Busca, numa consulta só, os produtos ligados a cada documento da lista. */
export async function produtosRelacionados(ids: string[]): Promise<Map<string, ProdutoResumo[]>> {
  const mapa = new Map<string, ProdutoResumo[]>();
  if (ids.length === 0) return mapa;

  const linhas = await db
    .select({
      documentoId: documentoProdutos.documentoId,
      id: produtos.id,
      codigo: produtos.codigo,
      nome: produtos.nome,
      segmento: produtos.segmento,
    })
    .from(documentoProdutos)
    .innerJoin(produtos, eq(produtos.id, documentoProdutos.produtoId))
    .where(inArray(documentoProdutos.documentoId, ids))
    .orderBy(produtos.codigo);

  for (const { documentoId, ...produto } of linhas) {
    const lista = mapa.get(documentoId) ?? [];
    lista.push(produto);
    mapa.set(documentoId, lista);
  }
  return mapa;
}

/** Usuários que estão na lista de acesso do documento. */
export function usuariosComAcesso(documentoId: string) {
  return db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      empresa: usuarios.empresa,
      status: usuarios.status,
    })
    .from(documentoAcessos)
    .innerJoin(usuarios, eq(usuarios.id, documentoAcessos.usuarioId))
    .where(eq(documentoAcessos.documentoId, documentoId))
    .orderBy(asc(usuarios.nome));
}

/** Documentos RESTRITOS liberados especificamente para esta pessoa. */
export function restritosLiberadosPara(usuarioId: string) {
  return db
    .select({ id: documentos.id, titulo: documentos.titulo, tipo: documentos.tipo })
    .from(documentoAcessos)
    .innerJoin(documentos, eq(documentos.id, documentoAcessos.documentoId))
    .where(and(eq(documentoAcessos.usuarioId, usuarioId), eq(documentos.visibilidade, 'RESTRITO')))
    .orderBy(asc(documentos.titulo));
}

/** Totais para o painel do administrador. */
export async function resumoParaPainel() {
  const [resumo] = await db
    .select({
      total: count(),
      publicados: contarSe(sql`${documentos.publicado}`),
      rascunhos: contarSe(sql`not ${documentos.publicado}`),
      publicos: contarSe(sql`${documentos.publicado} and ${documentos.visibilidade} = 'PUBLICO'`),
      autenticados: contarSe(sql`${documentos.publicado} and ${documentos.visibilidade} = 'AUTENTICADO'`),
      restritos: contarSe(sql`${documentos.publicado} and ${documentos.visibilidade} = 'RESTRITO'`),
    })
    .from(documentos);
  return resumo;
}

// ─── Escrita (área do administrador) ────────────────────────────────────────

export async function inserir(valores: NovoDocumento, tx: Transacao): Promise<string> {
  const [novo] = await tx.insert(documentos).values(valores).returning({ id: documentos.id });
  return novo!.id;
}

export async function atualizar(id: string, valores: Partial<NovoDocumento>, tx: Transacao) {
  await tx
    .update(documentos)
    .set({ ...valores, atualizadoEm: new Date() })
    .where(eq(documentos.id, id));
}

/** Exclui o documento e devolve a chave do arquivo (para apagá-lo do disco), ou undefined se não existia. */
export async function excluir(id: string): Promise<{ arquivoChave: string | null } | undefined> {
  const [removido] = await db
    .delete(documentos)
    .where(eq(documentos.id, id))
    .returning({ arquivoChave: documentos.arquivoChave });
  return removido;
}

/** Troca a lista de produtos relacionados ao documento. */
export async function substituirProdutos(documentoId: string, produtoIds: string[], tx: Transacao) {
  await tx.delete(documentoProdutos).where(eq(documentoProdutos.documentoId, documentoId));
  if (produtoIds.length > 0) {
    await tx
      .insert(documentoProdutos)
      .values(produtoIds.map((produtoId) => ({ documentoId, produtoId })));
  }
}

/**
 * Deixa a lista de acesso igual a `usuarioIds`. Quem já tinha acesso e
 * continua na lista mantém a data original de concessão.
 */
export async function sincronizarAcessos(documentoId: string, usuarioIds: string[], tx: Transacao) {
  await tx
    .delete(documentoAcessos)
    .where(
      and(
        eq(documentoAcessos.documentoId, documentoId),
        usuarioIds.length > 0 ? notInArray(documentoAcessos.usuarioId, usuarioIds) : undefined,
      ),
    );
  if (usuarioIds.length > 0) {
    await tx
      .insert(documentoAcessos)
      .values(usuarioIds.map((usuarioId) => ({ documentoId, usuarioId })))
      .onConflictDoNothing();
  }
}
