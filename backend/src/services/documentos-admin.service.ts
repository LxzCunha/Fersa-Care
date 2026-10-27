import { emTransacao, type Transacao } from '../db/index.js';
import { paraDocumentoDto } from '../dtos/documentos.dto.js';
import { removerArquivo, tipoDoArquivo } from '../lib/armazenamento.js';
import { naoEncontrado, requisicaoInvalida } from '../lib/erros.js';
import type { UsuarioAutenticado } from '../models/index.js';
import * as documentosRepository from '../repositories/documentos.repository.js';
import * as produtosRepository from '../repositories/produtos.repository.js';
import * as usuariosRepository from '../repositories/usuarios.repository.js';
import * as visualizacoesRepository from '../repositories/visualizacoes.repository.js';
import type { DadosDocumento, FiltrosDocumentos } from '../validators/documentos.validator.js';
import { listarPagina } from './documentos.service.js';

/**
 * Gestão de documentos pelo administrador: cadastrar, editar, excluir e
 * definir quem pode ver cada um.
 */

type ArquivoRecebido = Express.Multer.File;

/** O administrador vê tudo, inclusive rascunhos. */
const TUDO = { incluirRascunhos: true };

export function listarParaAdmin(filtros: FiltrosDocumentos, admin: UsuarioAutenticado) {
  return listarPagina(filtros, admin, TUDO);
}

export async function detalharParaAdmin(id: string, admin: UsuarioAutenticado) {
  const documento = await documentosRepository.buscarPorId(id, admin, TUDO);
  if (!documento) throw naoEncontrado('Documento não encontrado.');

  const [produtosRelacionados, usuariosComAcesso, autor, totalVisualizacoes] = await Promise.all([
    documentosRepository.produtosRelacionados([id]),
    documentosRepository.usuariosComAcesso(id),
    documento.criadoPor ? usuariosRepository.buscarPorId(documento.criadoPor) : Promise.resolve(undefined),
    visualizacoesRepository.contarDoDocumento(id),
  ]);

  return {
    ...paraDocumentoDto(documento, produtosRelacionados.get(id) ?? []),
    usuariosComAcesso,
    criadoPor: autor ? { id: autor.id, nome: autor.nome } : null,
    totalVisualizacoes,
  };
}

export async function criarDocumento(
  dados: DadosDocumento,
  arquivo: ArquivoRecebido | undefined,
  admin: UsuarioAutenticado,
) {
  const origem = camposDeOrigem(dados, arquivo, null);

  const id = await emTransacao(async (tx) => {
    await conferirReferencias(tx, dados);
    const novoId = await documentosRepository.inserir(
      { ...camposBasicos(dados), ...origem.campos, criadoPor: admin.id },
      tx,
    );
    await sincronizarRelacionamentos(tx, novoId, dados);
    return novoId;
  });

  return detalharParaAdmin(id, admin);
}

export async function atualizarDocumento(
  id: string,
  dados: DadosDocumento,
  arquivo: ArquivoRecebido | undefined,
  admin: UsuarioAutenticado,
) {
  const atual = await documentosRepository.buscarPorId(id, admin, TUDO);
  if (!atual) throw naoEncontrado('Documento não encontrado.');

  const origem = camposDeOrigem(dados, arquivo, atual.arquivoChave);

  await emTransacao(async (tx) => {
    await conferirReferencias(tx, dados);
    await documentosRepository.atualizar(id, { ...camposBasicos(dados), ...origem.campos }, tx);
    await sincronizarRelacionamentos(tx, id, dados);
  });

  // Só apaga o arquivo antigo depois que o banco confirmou a troca.
  if (origem.arquivoAntigoParaRemover) await removerArquivo(origem.arquivoAntigoParaRemover);

  return detalharParaAdmin(id, admin);
}

export async function excluirDocumento(id: string) {
  const removido = await documentosRepository.excluir(id);
  if (!removido) throw naoEncontrado('Documento não encontrado.');
  await removerArquivo(removido.arquivoChave);
}

// ─── Funções auxiliares ─────────────────────────────────────────────────────

function camposBasicos(dados: DadosDocumento) {
  return {
    titulo: dados.titulo,
    descricao: dados.descricao,
    tipo: dados.tipo,
    idioma: dados.idioma,
    visibilidade: dados.visibilidade,
    publicado: dados.publicado,
  };
}

/** Nomes de arquivo muito longos são encurtados preservando a extensão. */
function nomeSeguro(nomeOriginal: string): string {
  if (nomeOriginal.length <= 255) return nomeOriginal;
  const ponto = nomeOriginal.lastIndexOf('.');
  const extensao = ponto > 0 ? nomeOriginal.slice(ponto) : '';
  return nomeOriginal.slice(0, 255 - extensao.length) + extensao;
}

/**
 * Decide o que gravar nas colunas de arquivo/link:
 * - LINK: grava o endereço e marca o arquivo antigo (se havia) para remoção;
 * - ARQUIVO com novo upload: grava o arquivo novo e marca o antigo para remoção;
 * - ARQUIVO sem upload: mantém o arquivo atual (só na edição).
 */
function camposDeOrigem(dados: DadosDocumento, arquivo: ArquivoRecebido | undefined, arquivoAtual: string | null) {
  if (dados.origem === 'LINK') {
    if (arquivo) {
      throw requisicaoInvalida('Envie um arquivo ou informe um link, não os dois.');
    }
    return {
      campos: {
        arquivoChave: null,
        arquivoNome: null,
        arquivoMime: null,
        arquivoTamanho: null,
        urlExterna: dados.urlExterna!,
      },
      arquivoAntigoParaRemover: arquivoAtual,
    };
  }

  if (arquivo) {
    return {
      campos: {
        arquivoChave: arquivo.filename,
        arquivoNome: nomeSeguro(arquivo.originalname),
        arquivoMime: tipoDoArquivo(arquivo.originalname)?.mime ?? 'application/octet-stream',
        arquivoTamanho: arquivo.size,
        urlExterna: null,
      },
      arquivoAntigoParaRemover: arquivoAtual,
    };
  }

  if (arquivoAtual) return { campos: {}, arquivoAntigoParaRemover: null };

  throw requisicaoInvalida('Selecione o arquivo do documento.', [
    { campo: 'arquivo', mensagem: 'Selecione o arquivo do documento.' },
  ]);
}

/** Confere se os produtos e usuários escolhidos existem, com mensagem clara. */
async function conferirReferencias(tx: Transacao, dados: DadosDocumento) {
  const produtoIds = [...new Set(dados.produtoIds)];
  if (produtoIds.length > 0) {
    const encontrados = await produtosRepository.contarExistentes(produtoIds, tx);
    if (encontrados !== produtoIds.length) {
      throw requisicaoInvalida('Algum produto selecionado não existe mais. Atualize a página.');
    }
  }

  const usuarioIds = [...new Set(dados.usuarioIds)];
  if (dados.visibilidade === 'RESTRITO' && usuarioIds.length > 0) {
    const encontrados = await usuariosRepository.contarExistentes(usuarioIds, tx);
    if (encontrados !== usuarioIds.length) {
      throw requisicaoInvalida('Algum usuário selecionado não existe mais. Atualize a página.');
    }
  }
}

/**
 * Atualiza produtos relacionados e a lista de usuários com acesso.
 * A lista de acesso só existe para documentos RESTRITOS; nos demais ela é limpa.
 */
async function sincronizarRelacionamentos(tx: Transacao, documentoId: string, dados: DadosDocumento) {
  await documentosRepository.substituirProdutos(documentoId, [...new Set(dados.produtoIds)], tx);

  const usuarioIds = dados.visibilidade === 'RESTRITO' ? [...new Set(dados.usuarioIds)] : [];
  await documentosRepository.sincronizarAcessos(documentoId, usuarioIds, tx);
}
