import type { Request, Response } from 'express';
import * as saudeService from '../services/saude.service.js';

/**
 * Verificações de saúde, para Docker, Kubernetes e balanceadores:
 *   GET /api/saude         → o processo está de pé (liveness); não toca no banco.
 *   GET /api/saude/pronto  → pode receber tráfego (readiness): 503 sem banco.
 */

export function vivo(_req: Request, res: Response) {
  res.json({ status: 'ok', horario: new Date().toISOString() });
}

export async function pronto(_req: Request, res: Response) {
  const { pronto, ...resultado } = await saudeService.verificarProntidao();
  res.setHeader('Cache-Control', 'no-store');
  res.status(pronto ? 200 : 503).json({ ...resultado, horario: new Date().toISOString() });
}
