import { asc, cosineDistance, count, eq } from 'drizzle-orm';
import { db, type Transacao } from '../db/index.js';
import { documentos, documentoTrechos, type UsuarioAutenticado } from '../models/index.js';
import { condicaoDeVisibilidade } from './visibilidade.js';

export interface TrechoParaGravar {
  ordem: number;
  conteudo: string;
  embedding: number[];
}

export async function substituirTrechos(documentoId: string, trechos: TrechoParaGravar[], tx: Transacao) {
  await tx.delete(documentoTrechos).where(eq(documentoTrechos.documentoId, documentoId));
  if (trechos.length > 0) {
    await tx.insert(documentoTrechos).values(trechos.map((trecho) => ({ ...trecho, documentoId })));
  }
}

export async function contarDoDocumento(documentoId: string): Promise<number> {
  const [contagem] = await db
    .select({ total: count() })
    .from(documentoTrechos)
    .where(eq(documentoTrechos.documentoId, documentoId));
  return contagem?.total ?? 0;
}

/** Mesma regra da biblioteca, sem rascunhos nem para o admin. `distancia`: de 0 (igual) a 2 (oposto). */
export function buscarParecidos(embedding: number[], usuario: UsuarioAutenticado | undefined, limite: number) {
  const distancia = cosineDistance(documentoTrechos.embedding, embedding).mapWith(Number);
  return db
    .select({
      conteudo: documentoTrechos.conteudo,
      documentoId: documentos.id,
      titulo: documentos.titulo,
      tipo: documentos.tipo,
      distancia,
    })
    .from(documentoTrechos)
    .innerJoin(documentos, eq(documentos.id, documentoTrechos.documentoId))
    .where(condicaoDeVisibilidade(usuario))
    .orderBy(asc(distancia))
    .limit(limite);
}
