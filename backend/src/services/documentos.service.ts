import { paraDocumentoDto } from '../dtos/documentos.dto.js';
import { arquivoExiste, caminhoDoArquivo, tipoDoArquivo } from '../lib/armazenamento.js';
import { naoAutenticado, naoEncontrado } from '../lib/erros.js';
import { montarPagina } from '../lib/validacao.js';
import {
  tipoDocumento,
  type LinhaDocumento,
  type TipoDocumento,
  type UsuarioAutenticado,
} from '../models/index.js';
import * as documentosRepository from '../repositories/documentos.repository.js';
import * as visualizacoesRepository from '../repositories/visualizacoes.repository.js';
import type { FiltrosDocumentos } from '../validators/documentos.validator.js';

export async function listarPagina(
  filtros: Partial<FiltrosDocumentos> & { pagina: number; porPagina: number },
  usuario: UsuarioAutenticado | undefined,
  opcoes: { incluirRascunhos?: boolean } = {},
) {
  const { linhas, total } = await documentosRepository.listar(filtros, usuario, opcoes);
  const produtosPorDocumento = await documentosRepository.produtosRelacionados(linhas.map((linha) => linha.id));
  const itens = linhas.map((linha) => paraDocumentoDto(linha, produtosPorDocumento.get(linha.id) ?? []));
  return montarPagina(itens, total, filtros.pagina, filtros.porPagina);
}

export function listarDocumentosVisiveis(
  filtros: Omit<FiltrosDocumentos, 'visibilidade' | 'publicado'>,
  usuario: UsuarioAutenticado | undefined,
) {
  return listarPagina(filtros, usuario);
}

/** Visitante em documento que exige login: 401 (o site pede login). Sem permissão: 404, sem revelar que existe. */
export async function buscarDocumentoVisivel(
  id: string,
  usuario: UsuarioAutenticado | undefined,
): Promise<LinhaDocumento> {
  const documento = await documentosRepository.buscarPorId(id, usuario, { incluirRascunhos: true });
  if (documento) return documento;

  if (!usuario && (await documentosRepository.existePublicado(id))) {
    throw naoAutenticado('Entre com sua conta para acessar este documento.');
  }
  throw naoEncontrado('Documento não encontrado ou sem permissão de acesso.');
}

export async function abrirDocumento(id: string, usuario: UsuarioAutenticado | undefined) {
  const documento = await buscarDocumentoVisivel(id, usuario);
  const produtosRelacionados = await documentosRepository.produtosRelacionados([documento.id]);
  await registrarVisualizacao(documento.id, usuario);
  return paraDocumentoDto(documento, produtosRelacionados.get(documento.id) ?? []);
}

async function registrarVisualizacao(documentoId: string, usuario: UsuarioAutenticado | undefined) {
  if (usuario?.perfil === 'ADMIN') return;
  await visualizacoesRepository.registrar(documentoId, usuario?.id ?? null);
}

export type ConteudoDoDocumento =
  | { origem: 'LINK'; url: string }
  | { origem: 'ARQUIVO'; caminho: string; nome: string; mime: string; exibirNoNavegador: boolean };

export async function obterConteudoDoDocumento(
  id: string,
  usuario: UsuarioAutenticado | undefined,
): Promise<ConteudoDoDocumento> {
  const documento = await buscarDocumentoVisivel(id, usuario);
  if (documento.urlExterna) return { origem: 'LINK', url: documento.urlExterna };

  const chave = documento.arquivoChave;
  if (!chave || !(await arquivoExiste(chave))) {
    throw naoEncontrado('O arquivo deste documento não foi encontrado no servidor.');
  }

  const nome = documento.arquivoNome ?? chave;
  return {
    origem: 'ARQUIVO',
    caminho: caminhoDoArquivo(chave),
    nome,
    mime: documento.arquivoMime ?? 'application/octet-stream',
    exibirNoNavegador: tipoDoArquivo(nome)?.exibirNoNavegador ?? false,
  };
}

/** `publica`: a capa pode ficar em cache compartilhado (proxies, CDN). */
export async function obterCapa(id: string, usuario: UsuarioAutenticado | undefined) {
  const documento = await buscarDocumentoVisivel(id, usuario);
  const chave = documento.capaChave;
  if (!chave || !(await arquivoExiste(chave))) throw naoEncontrado('Este documento não tem capa.');
  return {
    caminho: caminhoDoArquivo(chave),
    publica: documento.publicado && documento.visibilidade === 'PUBLICO',
  };
}

export async function resumoDaBiblioteca(usuario: UsuarioAutenticado | undefined) {
  const linhasPorTipo = await documentosRepository.contarPorTipo(usuario);
  const porTipo = Object.fromEntries(tipoDocumento.enumValues.map((tipo) => [tipo, 0])) as Record<
    TipoDocumento,
    number
  >;
  for (const linha of linhasPorTipo) porTipo[linha.tipo] = linha.total;

  const recentes = await listarPagina({ pagina: 1, porPagina: 6 }, usuario);

  // Para visitantes: quantos materiais qualquer cliente cadastrado passa a ver ao entrar.
  const materiaisExclusivos = usuario ? null : await documentosRepository.contarPublicados('AUTENTICADO');

  return {
    totalDocumentos: recentes.total,
    porTipo,
    recentes: recentes.itens,
    materiaisExclusivos,
  };
}
