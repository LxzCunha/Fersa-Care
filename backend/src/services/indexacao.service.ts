import { env } from '../config/env.js';
import { emTransacao } from '../db/index.js';
import { arquivoExiste } from '../lib/armazenamento.js';
import { ROTULOS_DOS_TIPOS } from '../lib/assistente/instrucoes.js';
import { extrairTexto, temTextoLegivel, trechosDoDocumento } from '../lib/assistente/trechos.js';
import { gerarEmbeddings } from '../lib/ia.js';
import type { LinhaDocumento } from '../models/index.js';
import * as documentosRepository from '../repositories/documentos.repository.js';
import * as trechosRepository from '../repositories/trechos.repository.js';

/**
 * Indexação dos documentos para o assistente: extrai o texto, divide em
 * trechos, gera os embeddings e grava tudo em documento_trechos.
 * Roda numa fila em segundo plano: salvar um documento nunca espera a IA.
 */

/** Quantos trechos vão de uma vez para o modelo de embeddings. */
const TRECHOS_POR_LOTE = 16;

/** Indexa um documento agora. Devolve quantos trechos gravou (undefined se ele não existe mais). */
export async function indexarDocumento(id: string): Promise<{ trechos: number } | undefined> {
  const documento = await documentosRepository.dadosParaIndexar(id);
  if (!documento) return undefined;

  try {
    const paginas = await textoDoArquivo(documento.arquivoChave, documento.arquivoNome);
    const textos = trechosDoDocumento(
      {
        titulo: documento.titulo,
        tipo: ROTULOS_DOS_TIPOS[documento.tipo],
        descricao: documento.descricao,
        codigosDasPecas: documento.codigosDasPecas,
      },
      paginas,
    );

    const embeddings: number[][] = [];
    for (let inicio = 0; inicio < textos.length; inicio += TRECHOS_POR_LOTE) {
      embeddings.push(...(await gerarEmbeddings(textos.slice(inicio, inicio + TRECHOS_POR_LOTE))));
    }

    await emTransacao(async (tx) => {
      await trechosRepository.substituirTrechos(
        id,
        textos.map((conteudo, ordem) => ({ ordem, conteudo, embedding: embeddings[ordem]! })),
        tx,
      );
      await documentosRepository.marcarIndexacao(id, null, tx);
    });
    return { trechos: textos.length };
  } catch (erro) {
    await documentosRepository.marcarIndexacao(id, (erro instanceof Error ? erro.message : String(erro)).slice(0, 1000));
    throw erro;
  }
}

/**
 * Texto do arquivo, quando dá para ler. Arquivo corrompido ou que o leitor não
 * entende não impede a indexação: o documento entra só com a ficha (título,
 * tipo, peças e descrição) e continua sendo encontrado pelo assistente.
 */
async function textoDoArquivo(chave: string | null, nome: string | null) {
  if (!chave || !nome || !temTextoLegivel(nome) || !(await arquivoExiste(chave))) return [];
  try {
    return await extrairTexto(chave, nome);
  } catch (erro) {
    console.warn(`Não foi possível ler o texto de "${nome}":`, erro instanceof Error ? erro.message : erro);
    return [];
  }
}

// ─── Fila em segundo plano ──────────────────────────────────────────────────

let indexarAoSalvar = env.IA_INDEXAR_AO_SALVAR;
const naFila = new Set<string>();
let fila: Promise<void> = Promise.resolve();

/**
 * Põe o documento na fila (um de cada vez, na ordem de chegada). Se ele já
 * está esperando, não entra de novo. `forcar` vale mesmo com a indexação
 * automática desligada (o admin pediu).
 */
export function agendarIndexacao(id: string, { forcar = false } = {}) {
  if ((!indexarAoSalvar && !forcar) || naFila.has(id)) return;
  naFila.add(id);
  fila = fila.then(async () => {
    naFila.delete(id);
    try {
      await indexarDocumento(id);
    } catch (erro) {
      console.warn(`Indexação do documento ${id} falhou:`, erro instanceof Error ? erro.message : erro);
    }
  });
}

/** Espera a fila esvaziar (testes e comandos). */
export function aguardarFilaDeIndexacao(): Promise<void> {
  return fila;
}

/** Liga ou desliga a indexação ao salvar (os testes ligam só onde precisam). */
export function definirIndexacaoAoSalvar(ligada: boolean) {
  indexarAoSalvar = ligada;
}

/** Indexa os documentos pendentes (ou todos), um por vez. Usado pelo comando "npm run ia:indexar". */
export async function indexarPendentes({ todos = false } = {}) {
  const ids = await documentosRepository.listarParaIndexar(todos);
  let trechos = 0;
  const falhas: string[] = [];
  for (const id of ids) {
    try {
      trechos += (await indexarDocumento(id))?.trechos ?? 0;
    } catch (erro) {
      falhas.push(`${id}: ${erro instanceof Error ? erro.message : erro}`);
    }
  }
  return { documentos: ids.length, trechos, falhas };
}

export type SituacaoDaIndexacao = 'INDEXADO' | 'NA_FILA' | 'FALHOU';

/** Como o documento está para o assistente (mostrado ao admin). */
export function situacaoDaIndexacao(documento: Pick<LinhaDocumento, 'indexadoEm' | 'indexacaoErro' | 'atualizadoEm'>): SituacaoDaIndexacao {
  if (documento.indexacaoErro) return 'FALHOU';
  if (!documento.indexadoEm || documento.indexadoEm < documento.atualizadoEm) return 'NA_FILA';
  return 'INDEXADO';
}
