import type { Request, Response } from 'express';
import * as saudeService from '../services/saude.service.js';

// /saude: liveness, não toca no banco. /saude/pronto: readiness, 503 sem banco.

export function vivo(_req: Request, res: Response) {
  res.json({ status: 'ok', horario: new Date().toISOString() });
}

export async function pronto(_req: Request, res: Response) {
  const { pronto, ...resultado } = await saudeService.verificarProntidao();
  res.setHeader('Cache-Control', 'no-store');
  res.status(pronto ? 200 : 503).json({ ...resultado, horario: new Date().toISOString() });
}
