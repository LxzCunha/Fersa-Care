import type { Request, Response } from 'express';
import * as auditoriaService from '../services/auditoria.service.js';
import { esquemaFiltrosAuditoria } from '../validators/auditoria.validator.js';

export async function listar(req: Request, res: Response) {
  const filtros = esquemaFiltrosAuditoria.parse(req.query);
  res.json(await auditoriaService.listarEventos(filtros));
}
