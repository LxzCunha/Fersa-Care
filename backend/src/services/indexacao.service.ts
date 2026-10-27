import { env } from '../config/env.js';
import { emTransacao } from '../db/index.js';
import { arquivoExiste } from '../lib/armazenamento.js';
import { ROTULOS_DOS_TIPOS } from '../lib/assistente/instrucoes.js';
import { extrairTexto, temTextoLegivel, trechosDoDocumento } from '../lib/assistente/trechos.js';
import { gerarEmbeddings } from '../lib/ia.js';
import { log, mensagemDoErro } from '../lib/log.js';
import type { LinhaDocumento } from '../models/index.js';
import * as documentosRepository from '../repositories/documentos.repository.js';
import * as trechosRepository from '../repositories/trechos.repository.js';

const TRECHOS_POR_LOTE = 16;

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

/** Arquivo ilegível não impede a indexação: o documento entra só com a ficha. */
async function textoDoArquivo(chave: string | null, nome: string | null) {
  if (!chave || !nome || !temTextoLegivel(nome) || !(await arquivoExiste(chave))) return [];
  try {
    return await extrairTexto(chave, nome);
  } catch (erro) {
    log.warn({ arquivo: nome, motivo: mensagemDoErro(erro) }, 'Não foi possível ler o texto do arquivo');
    return [];
  }
}

let indexarAoSalvar = env.IA_INDEXAR_AO_SALVAR;
const naFila = new Set<string>();
let fila: Promise<void> = Promise.resolve();

/** `forcar` (pedido do admin) vale mesmo com a indexação ao salvar desligada. */
export function agendarIndexacao(id: string, { forcar = false } = {}) {
  if ((!indexarAoSalvar && !forcar) || naFila.has(id)) return;
  naFila.add(id);
  fila = fila.then(async () => {
    naFila.delete(id);
    try {
      await indexarDocumento(id);
    } catch (erro) {
      log.warn({ documentoId: id, motivo: mensagemDoErro(erro) }, 'Indexação do documento falhou');
    }
  });
}

export function aguardarFilaDeIndexacao(): Promise<void> {
  return fila;
}

export function definirIndexacaoAoSalvar(ligada: boolean) {
  indexarAoSalvar = ligada;
}

export async function indexarPendentes({ todos = false } = {}) {
  const ids = await documentosRepository.listarParaIndexar(todos);
  let trechos = 0;
  const falhas: string[] = [];
  for (const id of ids) {
    try {
      trechos += (await indexarDocumento(id))?.trechos ?? 0;
    } catch (erro) {
      falhas.push(`${id}: ${mensagemDoErro(erro)}`);
    }
  }
  return { documentos: ids.length, trechos, falhas };
}

export type SituacaoDaIndexacao = 'INDEXADO' | 'NA_FILA' | 'FALHOU';

export function situacaoDaIndexacao(documento: Pick<LinhaDocumento, 'indexadoEm' | 'indexacaoErro' | 'atualizadoEm'>): SituacaoDaIndexacao {
  if (documento.indexacaoErro) return 'FALHOU';
  if (!documento.indexadoEm || documento.indexadoEm < documento.atualizadoEm) return 'NA_FILA';
  return 'INDEXADO';
}
