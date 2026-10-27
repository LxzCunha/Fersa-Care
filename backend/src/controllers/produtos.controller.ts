import type { Request, Response } from 'express';
import { esquemaParametroId, lerDadosDoFormulario } from '../lib/validacao.js';
import { arquivoEnviado } from '../middlewares/upload.js';
import * as produtosService from '../services/produtos.service.js';
import {
  esquemaFiltrosProdutos,
  esquemaFiltrosProdutosAdmin,
  esquemaProduto,
} from '../validators/produtos.validator.js';

/** Catálogo público (/api/produtos/...) e gestão do catálogo (/api/admin/produtos/...). */

// ─── Portal ─────────────────────────────────────────────────────────────────

export async function listar(req: Request, res: Response) {
  const filtros = esquemaFiltrosProdutos.parse(req.query);
  res.json(await produtosService.listarProdutos(filtros, { incluirInativos: false }));
}

export async function detalhar(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  res.json(await produtosService.detalharProdutoNoPortal(id, req.usuario));
}

/** Foto da peça. A URL muda a cada edição (?v=), então peças do catálogo podem ficar em cache. */
export async function imagem(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  const foto = await produtosService.obterImagem(id, req.usuario);
  res.setHeader('Content-Type', foto.mime);
  res.setHeader('Cache-Control', foto.publica ? 'public, max-age=31536000, immutable' : 'private, no-cache');
  res.sendFile(foto.caminho, { cacheControl: false });
}

// ─── Administração ──────────────────────────────────────────────────────────
// Cadastro e edição aceitam multipart/form-data (campo "imagem" + campo "dados"
// em JSON) ou application/json direto no corpo, quando não há foto nova.

export async function listarParaAdmin(req: Request, res: Response) {
  const filtros = esquemaFiltrosProdutosAdmin.parse(req.query);
  res.json(await produtosService.listarProdutos(filtros, { incluirInativos: true }));
}

export async function detalharParaAdmin(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  res.json(await produtosService.detalharProdutoParaAdmin(id));
}

export async function criar(req: Request, res: Response) {
  const dados = esquemaProduto.parse(lerDadosDoFormulario(req));
  res.status(201).json(await produtosService.criarProduto(dados, arquivoEnviado(req, 'imagem')));
}

export async function atualizar(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  const dados = esquemaProduto.parse(lerDadosDoFormulario(req));
  res.json(await produtosService.atualizarProduto(id, dados, arquivoEnviado(req, 'imagem')));
}

export async function excluir(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  await produtosService.excluirProduto(id);
  res.status(204).end();
}
