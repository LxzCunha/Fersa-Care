import { and, asc, count, desc, eq, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import { db, type Transacao } from '../db/index.js';
import { escaparLike, termosDaBusca } from '../lib/validacao.js';
import { usuarios, type NovoUsuario, type Usuario } from '../models/index.js';
import type { FiltrosUsuarios } from '../validators/usuarios.validator.js';
import { contarSe } from './sql.js';

/** Acesso à tabela usuarios. */

function condicaoDeBusca(busca: string | undefined): SQL | undefined {
  const termos = termosDaBusca(busca ?? '');
  if (termos.length === 0) return undefined;
  return and(
    ...termos.map((termo) => {
      const padrao = `%${escaparLike(termo)}%`;
      return or(
        sql`f_unaccent(${usuarios.nome}) ILIKE f_unaccent(${padrao})`,
        sql`${usuarios.email} ILIKE ${padrao}`,
        sql`f_unaccent(coalesce(${usuarios.empresa}, '')) ILIKE f_unaccent(${padrao})`,
      );
    }),
  );
}

function condicaoDosFiltros(filtros: Pick<FiltrosUsuarios, 'busca' | 'perfil'>): SQL | undefined {
  return and(
    condicaoDeBusca(filtros.busca),
    filtros.perfil ? eq(usuarios.perfil, filtros.perfil) : undefined,
  );
}

export async function buscarPorId(id: string): Promise<Usuario | undefined> {
  const [usuario] = await db.select().from(usuarios).where(eq(usuarios.id, id)).limit(1);
  return usuario;
}

export async function buscarPorEmail(email: string): Promise<Usuario | undefined> {
  const [usuario] = await db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1);
  return usuario;
}

/** Uma página de usuários; solicitações pendentes aparecem primeiro. */
export async function listar(filtros: FiltrosUsuarios): Promise<{ linhas: Usuario[]; total: number }> {
  const onde = and(
    condicaoDosFiltros(filtros),
    filtros.status ? eq(usuarios.status, filtros.status) : undefined,
  );

  const [contagem] = await db.select({ total: count() }).from(usuarios).where(onde);
  const linhas = await db
    .select()
    .from(usuarios)
    .where(onde)
    .orderBy(desc(sql`${usuarios.status} = 'PENDENTE'`), desc(usuarios.criadoEm))
    .limit(filtros.porPagina)
    .offset((filtros.pagina - 1) * filtros.porPagina);

  return { linhas, total: contagem?.total ?? 0 };
}

/** Quantidade por situação, respeitando busca e perfil (para as abas da tela). */
export function contarPorStatus(filtros: Pick<FiltrosUsuarios, 'busca' | 'perfil'>) {
  return db
    .select({ status: usuarios.status, total: count() })
    .from(usuarios)
    .where(condicaoDosFiltros(filtros))
    .groupBy(usuarios.status);
}

/** Administradores ativos, tirando o usuário informado. */
export async function contarOutrosAdminsAtivos(usuarioId: string): Promise<number> {
  const [contagem] = await db
    .select({ total: count() })
    .from(usuarios)
    .where(and(eq(usuarios.perfil, 'ADMIN'), eq(usuarios.status, 'ATIVO'), ne(usuarios.id, usuarioId)));
  return contagem?.total ?? 0;
}

/** Quantos dos ids informados existem (para conferir referências antes de gravar). */
export async function contarExistentes(ids: string[], tx: Transacao): Promise<number> {
  const encontrados = await tx.select({ id: usuarios.id }).from(usuarios).where(inArray(usuarios.id, ids));
  return encontrados.length;
}

export async function inserir(valores: NovoUsuario): Promise<Usuario> {
  const [usuario] = await db.insert(usuarios).values(valores).returning();
  return usuario!;
}

export async function atualizar(id: string, valores: Partial<NovoUsuario>): Promise<Usuario | undefined> {
  const [usuario] = await db
    .update(usuarios)
    .set({ ...valores, atualizadoEm: new Date() })
    .where(eq(usuarios.id, id))
    .returning();
  return usuario;
}

/** Marca o horário do login (não conta como edição do cadastro). */
export async function registrarAcesso(id: string): Promise<Usuario | undefined> {
  const [usuario] = await db
    .update(usuarios)
    .set({ ultimoAcessoEm: new Date() })
    .where(eq(usuarios.id, id))
    .returning();
  return usuario;
}

export async function excluir(id: string): Promise<void> {
  await db.delete(usuarios).where(eq(usuarios.id, id));
}

/** Totais para o painel do administrador. */
export async function resumoParaPainel() {
  const [resumo] = await db
    .select({
      clientesAtivos: contarSe(sql`${usuarios.perfil} = 'USUARIO' and ${usuarios.status} = 'ATIVO'`),
      pendentes: contarSe(sql`${usuarios.status} = 'PENDENTE'`),
      inativos: contarSe(sql`${usuarios.status} = 'INATIVO'`),
      administradores: contarSe(sql`${usuarios.perfil} = 'ADMIN' and ${usuarios.status} = 'ATIVO'`),
    })
    .from(usuarios);
  return resumo;
}

/** Solicitações de acesso mais antigas primeiro. */
export function listarPendentes(limite: number) {
  return db
    .select()
    .from(usuarios)
    .where(eq(usuarios.status, 'PENDENTE'))
    .orderBy(asc(usuarios.criadoEm))
    .limit(limite);
}
