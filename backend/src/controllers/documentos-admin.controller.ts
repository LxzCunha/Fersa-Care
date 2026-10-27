import type { Request, Response } from 'express';
import { esquemaParametroId, lerDadosDoFormulario } from '../lib/validacao.js';
import { usuarioLogado } from '../middlewares/autenticacao.js';
import * as documentosAdminService from '../services/documentos-admin.service.js';
import { esquemaDocumento, esquemaFiltrosDocumentosAdmin } from '../validators/documentos.validator.js';

/**
 * Gestão de documentos: /api/admin/documentos/...
 *
 * Cadastro e edição aceitam:
 * - multipart/form-data com o campo "arquivo" + o campo "dados" (JSON), ou
 * - application/json direto no corpo, quando o conteúdo é um link.
 */

export async function listar(req: Request, res: Response) {
  const filtros = esquemaFiltrosDocumentosAdmin.parse(req.query);
  res.json(await documentosAdminService.listarParaAdmin(filtros, usuarioLogado(req)));
}

export async function detalhar(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  res.json(await documentosAdminService.detalharParaAdmin(id, usuarioLogado(req)));
}

export async function criar(req: Request, res: Response) {
  const dados = esquemaDocumento.parse(lerDadosDoFormulario(req));
  const documento = await documentosAdminService.criarDocumento(dados, req.file, usuarioLogado(req));
  res.status(201).json(documento);
}

export async function atualizar(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  const dados = esquemaDocumento.parse(lerDadosDoFormulario(req));
  res.json(await documentosAdminService.atualizarDocumento(id, dados, req.file, usuarioLogado(req)));
}

export async function excluir(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  await documentosAdminService.excluirDocumento(id);
  res.status(204).end();
}
