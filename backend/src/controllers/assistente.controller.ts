import type { Request, Response } from 'express';
import { log } from '../lib/log.js';
import { esquemaParametroId } from '../lib/validacao.js';
import * as assistenteService from '../services/assistente.service.js';
import { esquemaPergunta } from '../validators/assistente.validator.js';
import { esquemaAbrirChamado } from '../validators/chamados.validator.js';

/**
 * Assistente técnico: /api/assistente/...
 * Aberto a visitantes; cada um só encontra o que pode ver no portal.
 */

/**
 * Pergunta ao assistente. A resposta chega aos pedaços (Server-Sent Events):
 *   event: conversa → { conversaId }        (guarde para continuar a conversa)
 *   event: texto    → { texto }             (um pedaço da resposta)
 *   event: fim      → { fontes, encaminhamento, chamado }
 *   event: erro     → { mensagem }          (falha no meio da resposta)
 */
export async function perguntar(req: Request, res: Response) {
  const dados = esquemaPergunta.parse(req.body);
  const interromper = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) interromper.abort(); // a pessoa fechou o chat: para de gerar
  });

  const eventos = assistenteService.responder(dados, req.usuario, interromper.signal);
  // O primeiro evento confere a conversa: se ela não existe, a resposta é um erro JSON normal (404).
  const primeiro = await eventos.next();

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no'); // nginx: não segurar os pedaços
  res.flushHeaders();

  const enviar = (evento: { tipo: string }) => res.write(`event: ${evento.tipo}\ndata: ${JSON.stringify(evento)}\n\n`);
  try {
    if (!primeiro.done) enviar(primeiro.value);
    for await (const evento of eventos) enviar(evento);
  } catch (erro) {
    if (!interromper.signal.aborted) {
      log.error({ err: erro }, 'Erro no assistente');
      enviar({ tipo: 'erro', mensagem: 'Não foi possível responder agora. Tente de novo em instantes.' } as { tipo: string });
    }
  }
  res.end();
}

export async function conversa(req: Request, res: Response) {
  const { id } = esquemaParametroId.parse(req.params);
  res.json(await assistenteService.obterConversa(id, req.usuario));
}

export async function abrirChamado(req: Request, res: Response) {
  const dados = esquemaAbrirChamado.parse(req.body);
  res.status(201).json(await assistenteService.abrirChamadoPeloChat(dados, req.usuario));
}
