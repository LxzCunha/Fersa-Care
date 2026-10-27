import type { Request, Response } from 'express';
import { esquemaParametroId } from '../lib/validacao.js';
import * as categoriasService from '../services/categorias.service.js';
import { esquemaCategoria, esquemaFiltrosCategorias } from '../validators/categorias.validator.js';

/** Categorias no portal (/api/categorias) e na administração (/api/admin/categorias/...). */

// ─── Portal ─────────────────────────────────────────────────────────────────

export async function listar(_req: Request, res: Response) {
  res.json(await categoriasService.listarCategoriasDoPortal());
}

// ─── Administração ──────────────────────────────────────────────────────────

export async function listarParaAdmin(req: Request, res: Response) {
  const filtros = esquemaFiltrosCategorias.parse(req.query);
  res.json(await categoriasService.listarCategoriasParaAdmin(filtros));
}

export async function detalhar(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  res.json(await categoriasService.detalharCategoria(id));
}

export async function criar(req: Request, res: Response) {
  const dados = esquemaCategoria.parse(req.body);
  res.status(201).json(await categoriasService.criarCategoria(dados));
}

export async function atualizar(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  const dados = esquemaCategoria.parse(req.body);
  res.json(await categoriasService.atualizarCategoria(id, dados));
}

export async function excluir(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  await categoriasService.excluirCategoria(id);
  res.status(204).end();
}
