import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  assistenteConversas,
  assistenteMensagens,
  type AssistenteConversa,
  type AssistenteMensagem,
  type NovaAssistenteMensagem,
} from '../models/index.js';

export async function criarConversa(usuarioId: string | null): Promise<AssistenteConversa> {
  const [conversa] = await db.insert(assistenteConversas).values({ usuarioId }).returning();
  return conversa!;
}

export async function buscarConversa(id: string): Promise<AssistenteConversa | undefined> {
  const [conversa] = await db.select().from(assistenteConversas).where(eq(assistenteConversas.id, id)).limit(1);
  return conversa;
}

export function listarMensagens(conversaId: string): Promise<AssistenteMensagem[]> {
  return db
    .select()
    .from(assistenteMensagens)
    .where(eq(assistenteMensagens.conversaId, conversaId))
    .orderBy(asc(assistenteMensagens.criadoEm), asc(assistenteMensagens.papel));
}

export async function adicionarMensagem(mensagem: NovaAssistenteMensagem): Promise<AssistenteMensagem> {
  const [nova] = await db.insert(assistenteMensagens).values(mensagem).returning();
  await db
    .update(assistenteConversas)
    .set({ atualizadoEm: new Date() })
    .where(eq(assistenteConversas.id, mensagem.conversaId));
  return nova!;
}
