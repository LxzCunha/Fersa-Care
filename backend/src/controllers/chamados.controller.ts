import type { Request, Response } from 'express';
import { esquemaParametroId } from '../lib/validacao.js';
import * as chamadosService from '../services/chamados.service.js';
import { esquemaAtualizarChamado, esquemaFiltrosChamados } from '../validators/chamados.validator.js';

/** Chamados de suporte técnico: /api/admin/chamados/... */

export async function listar(req: Request, res: Response) {
  const filtros = esquemaFiltrosChamados.parse(req.query);
  res.json(await chamadosService.listarChamados(filtros));
}

export async function detalhar(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  res.json(await chamadosService.detalharChamado(id));
}

export async function atualizar(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  const dados = esquemaAtualizarChamado.parse(req.body);
  res.json(await chamadosService.atualizarChamado(id, dados));
}
