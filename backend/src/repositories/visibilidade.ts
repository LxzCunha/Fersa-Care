import { and, eq, exists, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { documentoAcessos, documentos, type UsuarioAutenticado } from '../models/index.js';

/** Regra única de acesso: toda consulta que devolve documentos passa por aqui (só nos repositories). */
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
