import { and, eq, exists, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { documentoAcessos, documentos, type UsuarioAutenticado } from '../models/index.js';

/**
 * REGRA ÚNICA DE ACESSO AOS DOCUMENTOS
 * ────────────────────────────────────
 * Toda consulta que devolve documentos (lista, detalhe, download, contagens e,
 * na fase 2, a busca do assistente com RAG) passa por esta condição. Assim a
 * regra fica num lugar só e não há como uma tela mostrar o que outra esconde.
 *
 *   Visitante  → documentos PUBLICOS e publicados
 *   Usuário    → PUBLICOS + AUTENTICADOS + RESTRITOS liberados para ele (publicados)
 *   Admin      → todos os publicados; com `incluirRascunhos`, também os rascunhos
 *
 * Retorna `undefined` quando não há restrição (admin vendo tudo).
 * Só os repositories usam esta função: os services dizem para quem é a
 * consulta (o usuário da requisição) e o repository aplica a regra.
 */
export function condicaoDeVisibilidade(
  usuario: UsuarioAutenticado | undefined,
  opcoes: { incluirRascunhos?: boolean } = {},
): SQL | undefined {
  const somentePublicados = eq(documentos.publicado, true);

  if (usuario?.perfil === 'ADMIN') {
    return opcoes.incluirRascunhos ? undefined : somentePublicados;
  }

  if (!usuario) {
    return and(somentePublicados, eq(documentos.visibilidade, 'PUBLICO'));
  }

  const liberadoParaEsteUsuario = exists(
    db
      .select({ um: sql`1` })
      .from(documentoAcessos)
      .where(
        and(
          eq(documentoAcessos.documentoId, documentos.id),
          eq(documentoAcessos.usuarioId, usuario.id),
        ),
      ),
  );

  return and(
    somentePublicados,
    or(
      eq(documentos.visibilidade, 'PUBLICO'),
      eq(documentos.visibilidade, 'AUTENTICADO'),
      and(eq(documentos.visibilidade, 'RESTRITO'), liberadoParaEsteUsuario),
    ),
  );
}
