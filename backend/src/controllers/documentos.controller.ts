import { create as contentDisposition } from 'content-disposition';
import type { Request, Response } from 'express';
import { esquemaParametroId } from '../lib/validacao.js';
import * as documentosService from '../services/documentos.service.js';
import { esquemaFiltrosDocumentos } from '../validators/documentos.validator.js';

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

/** A URL muda a cada edição (?v=), então a capa de documento público pode ser immutable. */
export async function capa(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  const imagem = await documentosService.obterCapa(id, req.usuario);
  res.setHeader('Content-Type', 'image/webp');
  res.setHeader('Cache-Control', imagem.publica ? 'public, max-age=31536000, immutable' : 'private, max-age=86400');
  res.sendFile(imagem.caminho, { cacheControl: false });
}

export async function baixarArquivo(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  const conteudo = await documentosService.obterConteudoDoDocumento(id, req.usuario);

  if (conteudo.origem === 'LINK') {
    res.redirect(302, conteudo.url);
    return;
  }

  const forcarDownload = req.query.download === '1' || req.query.download === 'true';
  const abrirNoNavegador = !forcarDownload && conteudo.exibirNoNavegador;

  // A CSP bloqueia o leitor de PDF do Chrome; os tipos aceitos não executam scripts (sem HTML/SVG) e há nosniff.
  res.removeHeader('Content-Security-Policy');
  res.setHeader('Content-Type', conteudo.mime);
  res.setHeader(
    'Content-Disposition',
    contentDisposition(conteudo.nome, { type: abrirNoNavegador ? 'inline' : 'attachment' }),
  );
  res.setHeader('Cache-Control', 'private, no-cache');
  res.sendFile(conteudo.caminho, { cacheControl: false });
}
