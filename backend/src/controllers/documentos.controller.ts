import { create as contentDisposition } from 'content-disposition';
import type { Request, Response } from 'express';
import { esquemaParametroId } from '../lib/validacao.js';
import * as documentosService from '../services/documentos.service.js';
import { esquemaFiltrosDocumentos } from '../validators/documentos.validator.js';

/**
 * Biblioteca pública: /api/documentos/...
 * Aberta a visitantes, usuários e admins — cada um recebe só o que pode ver.
 */

export async function listar(req: Request, res: Response) {
  const filtros = esquemaFiltrosDocumentos.parse(req.query);
  res.json(await documentosService.listarDocumentosVisiveis(filtros, req.usuario));
}

export async function resumo(req: Request, res: Response) {
  res.json(await documentosService.resumoDaBiblioteca(req.usuario));
}

export async function detalhar(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  res.json(await documentosService.abrirDocumento(id, req.usuario));
}

/**
 * Entrega o conteúdo do documento depois de conferir a permissão.
 * - Arquivo: abre no navegador quando possível (PDF, imagem, vídeo);
 *   com ?download=1 força o download. Suporta Range, então vídeos podem ser adiantados.
 * - Link externo: redireciona para o endereço cadastrado.
 */
export async function baixarArquivo(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  const conteudo = await documentosService.obterConteudoDoDocumento(id, req.usuario);

  if (conteudo.origem === 'LINK') {
    res.redirect(302, conteudo.url);
    return;
  }

  const forcarDownload = req.query.download === '1' || req.query.download === 'true';
  const abrirNoNavegador = !forcarDownload && conteudo.exibirNoNavegador;

  // A política de segurança (CSP) das páginas impede o leitor de PDF embutido do
  // Chrome de abrir o arquivo. Os tipos aceitos no upload não executam scripts
  // (sem HTML/SVG) e o nosniff continua ativo, então a CSP não é necessária aqui.
  res.removeHeader('Content-Security-Policy');
  res.setHeader('Content-Type', conteudo.mime);
  res.setHeader(
    'Content-Disposition',
    contentDisposition(conteudo.nome, { type: abrirNoNavegador ? 'inline' : 'attachment' }),
  );
  // Conteúdo protegido: nada de cache compartilhado (proxies, CDN).
  res.setHeader('Cache-Control', 'private, no-cache');
  res.sendFile(conteudo.caminho, { cacheControl: false });
}
