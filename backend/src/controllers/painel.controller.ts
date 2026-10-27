import type { Request, Response } from 'express';
import * as painelService from '../services/painel.service.js';

/** Números do painel: /api/admin/painel */

export async function obter(_req: Request, res: Response) {
  res.json(await painelService.obterPainel());
}
