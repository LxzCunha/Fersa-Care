import { emTransacao, type Transacao } from '../db/index.js';
import { paraDocumentoDto } from '../dtos/documentos.dto.js';
import { removerArquivo, tipoDoArquivo } from '../lib/armazenamento.js';
import { gerarCapa, temCapaAutomatica } from '../lib/capas.js';
import { naoEncontrado, requisicaoInvalida } from '../lib/erros.js';
import type { LinhaDocumento, UsuarioAutenticado } from '../models/index.js';
import * as documentosRepository from '../repositories/documentos.repository.js';
import * as produtosRepository from '../repositories/produtos.repository.js';
import * as trechosRepository from '../repositories/trechos.repository.js';
import * as usuariosRepository from '../repositories/usuarios.repository.js';
import * as visualizacoesRepository from '../repositories/visualizacoes.repository.js';
import type { DadosDocumento, FiltrosDocumentos } from '../validators/documentos.validator.js';
import { listarPagina } from './documentos.service.js';
import { agendarIndexacao, situacaoDaIndexacao } from './indexacao.service.js';

/**
 * Gestão de documentos pelo administrador: cadastrar, editar, excluir e
 * definir quem pode ver cada um.
 */

type ArquivoRecebido = Express.Multer.File;

/** Arquivos que podem vir no formulário: o do documento e uma capa própria. */
export interface ArquivosDoDocumento {
  arquivo?: ArquivoRecebido;
  capa?: ArquivoRecebido;
}

/** O administrador vê tudo, inclusive rascunhos. */
const TUDO = { incluirRascunhos: true };

export function listarParaAdmin(filtros: FiltrosDocumentos, admin: UsuarioAutenticado) {
  return listarPagina(filtros, admin, TUDO);
}

export async function detalharParaAdmin(id: string, admin: UsuarioAutenticado) {
  const documento = await documentosRepository.buscarPorId(id, admin, TUDO);
  if (!documento) throw naoEncontrado('Documento não encontrado.');

  const [produtosRelacionados, usuariosComAcesso, autor, totalVisualizacoes, trechos] = await Promise.all([
    documentosRepository.produtosRelacionados([id]),
    documentosRepository.usuariosComAcesso(id),
    documento.criadoPor ? usuariosRepository.buscarPorId(documento.criadoPor) : Promise.resolve(undefined),
    visualizacoesRepository.contarDoDocumento(id),
    trechosRepository.contarDoDocumento(id),
  ]);

  return {
    ...paraDocumentoDto(documento, produtosRelacionados.get(id) ?? []),
    usuariosComAcesso,
    criadoPor: autor ? { id: autor.id, nome: autor.nome } : null,
    totalVisualizacoes,
    /** Como o documento está na base do assistente. */
    indexacao: {
      situacao: situacaoDaIndexacao(documento),
      indexadoEm: documento.indexadoEm,
      erro: documento.indexacaoErro,
      trechos,
    },
  };
}

export async function criarDocumento(
  dados: DadosDocumento,
  arquivos: ArquivosDoDocumento,
  admin: UsuarioAutenticado,
) {
  const origem = camposDeOrigem(dados, arquivos.arquivo, null);
  const capa = await definirCapa(dados, arquivos, null);

  const id = await desfazendoCapaSeFalhar(capa, () =>
    emTransacao(async (tx) => {
      await conferirReferencias(tx, dados);
      const novoId = await documentosRepository.inserir(
        { ...camposBasicos(dados), ...origem.campos, ...capa.campos, criadoPor: admin.id },
        tx,
      );
      await sincronizarRelacionamentos(tx, novoId, dados);
      return novoId;
    }),
  );

  // O assistente passa a conhecer o documento (em segundo plano, sem esperar a IA).
  agendarIndexacao(id);
  return detalharParaAdmin(id, admin);
}

export async function atualizarDocumento(
  id: string,
  dados: DadosDocumento,
  arquivos: ArquivosDoDocumento,
  admin: UsuarioAutenticado,
) {
  const atual = await documentosRepository.buscarPorId(id, admin, TUDO);
  if (!atual) throw naoEncontrado('Documento não encontrado.');

  const origem = camposDeOrigem(dados, arquivos.arquivo, atual.arquivoChave);
  const capa = await definirCapa(dados, arquivos, atual);

  await desfazendoCapaSeFalhar(capa, () =>
    emTransacao(async (tx) => {
      await conferirReferencias(tx, dados);
      await documentosRepository.atualizar(id, { ...camposBasicos(dados), ...origem.campos, ...capa.campos }, tx);
      await sincronizarRelacionamentos(tx, id, dados);
    }),
  );

  // Só apaga o arquivo e a capa antigos depois que o banco confirmou a troca.
  if (origem.arquivoAntigoParaRemover) await removerArquivo(origem.arquivoAntigoParaRemover);
  await removerArquivo(capa.capaAntiga);

  agendarIndexacao(id);
  return detalharParaAdmin(id, admin);
}

/** O admin pede para refazer a indexação (ex.: depois de uma falha). */
export async function reindexarDocumento(id: string, admin: UsuarioAutenticado) {
  const documento = await documentosRepository.buscarPorId(id, admin, TUDO);
  if (!documento) throw naoEncontrado('Documento não encontrado.');
  agendarIndexacao(id, { forcar: true });
}

export async function excluirDocumento(id: string) {
  const removido = await documentosRepository.excluir(id);
  if (!removido) throw naoEncontrado('Documento não encontrado.');
  await removerArquivo(removido.arquivoChave);
  await removerArquivo(removido.capaChave);
}

/**
 * Gera a capa automática dos documentos que ainda não têm uma (cadastrados
 * antes das capas existirem). Usada pelo comando "npm run capas:gerar".
 */
export async function gerarCapasPendentes() {
  const pendentes = await documentosRepository.listarSemCapa();
  let geradas = 0;
  for (const documento of pendentes) {
    const chave = await gerarCapaAutomatica({ chave: documento.arquivoChave, nome: documento.arquivoNome });
    if (!chave) continue;
    await documentosRepository.definirCapa(documento.id, chave);
    geradas++;
  }
  return { pendentes: pendentes.length, geradas };
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

interface DecisaoDeCapa {
  /** Colunas a gravar; vazio quando a capa continua a mesma. */
  campos: { capaChave?: string | null; capaPersonalizada?: boolean };
  /** Capa gerada nesta requisição: é apagada se a gravação no banco falhar. */
  capaNova: string | null;
  /** Capa substituída: é apagada depois que o banco confirmar a troca. */
  capaAntiga: string | null;
}

/**
 * Decide a capa do documento:
 * - o admin enviou uma capa: ela vale até ser removida, mesmo se o arquivo mudar;
 * - documento novo, "removerCapa" ou arquivo trocado (inclusive por um link): capa automática;
 * - nos demais casos, a capa atual continua. Documentos ainda sem capa ganham a automática.
 * A capa automática vem do arquivo novo ou, se não veio um, do arquivo atual.
 */
async function definirCapa(
  dados: DadosDocumento,
  arquivos: ArquivosDoDocumento,
  atual: LinhaDocumento | null,
): Promise<DecisaoDeCapa> {
  const capaAntiga = atual?.capaChave ?? null;

  if (arquivos.capa) {
    const chave = await gerarCapaEnviada(arquivos.capa);
    return { campos: { capaChave: chave, capaPersonalizada: true }, capaNova: chave, capaAntiga };
  }

  const refazerAutomatica =
    !atual ||
    (atual.capaPersonalizada
      ? dados.removerCapa
      : Boolean(arquivos.arquivo) || dados.origem === 'LINK' || !atual.capaChave);
  if (!refazerAutomatica) return { campos: {}, capaNova: null, capaAntiga: null };

  const fonte =
    dados.origem === 'LINK'
      ? null
      : arquivos.arquivo
        ? { chave: arquivos.arquivo.filename, nome: arquivos.arquivo.originalname }
        : { chave: atual?.arquivoChave ?? null, nome: atual?.arquivoNome ?? null };
  const chave = fonte ? await gerarCapaAutomatica(fonte) : null;
  return { campos: { capaChave: chave, capaPersonalizada: false }, capaNova: chave, capaAntiga };
}

/**
 * Capa tirada do próprio arquivo (1ª página do PDF ou a imagem). Se não der
 * para gerar, o documento fica sem capa: isso nunca impede o cadastro.
 */
async function gerarCapaAutomatica(arquivo: { chave: string | null; nome: string | null }): Promise<string | null> {
  if (!arquivo.chave || !arquivo.nome || !temCapaAutomatica(arquivo.nome)) return null;
  try {
    return await gerarCapa(arquivo.chave, arquivo.nome);
  } catch (erro) {
    console.warn(`Não foi possível gerar a capa de "${arquivo.nome}":`, erro instanceof Error ? erro.message : erro);
    return null;
  }
}

/** Capa enviada pelo admin: guardamos só a versão reduzida, não a imagem original. */
async function gerarCapaEnviada(capa: ArquivoRecebido): Promise<string> {
  try {
    return await gerarCapa(capa.filename, capa.originalname);
  } catch {
    const mensagem = 'Não foi possível ler esta imagem. Envie a capa em PNG, JPG ou WebP.';
    throw requisicaoInvalida(mensagem, [{ campo: 'capa', mensagem }]);
  } finally {
    await removerArquivo(capa.filename);
  }
}

async function desfazendoCapaSeFalhar<T>(capa: DecisaoDeCapa, gravar: () => Promise<T>): Promise<T> {
  try {
    return await gravar();
  } catch (erro) {
    await removerArquivo(capa.capaNova);
    throw erro;
  }
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
