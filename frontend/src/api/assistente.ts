import { api, ErroApi, type CorpoDeErro } from './cliente';
import type { ConversaDoAssistente, EventoDoAssistente } from './tipos';

/**
 * Pergunta ao assistente técnico. A resposta chega aos pedaços
 * (Server-Sent Events) e cada evento é entregue a `aoEvento` na hora.
 * Erros antes do streaming (pergunta inválida, conversa que não existe,
 * limite de perguntas) viram ErroApi, como nas outras chamadas.
 */
export async function perguntarAoAssistente(
  dados: { pergunta: string; conversaId?: string },
  aoEvento: (evento: EventoDoAssistente) => void,
  sinal?: AbortSignal,
): Promise<void> {
  let resposta: Response;
  try {
    resposta = await fetch('/api/assistente/perguntas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(dados),
      credentials: 'same-origin',
      signal: sinal,
    });
  } catch (erro) {
    if (sinal?.aborted) throw erro;
    throw new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão com o portal. Confira a internet e tente de novo.');
  }

  if (!resposta.ok || !resposta.body) {
    const corpo: unknown = await resposta.json().catch(() => null);
    const erro = (corpo as CorpoDeErro)?.erro;
    throw new ErroApi(
      resposta.status,
      erro?.codigo ?? 'ERRO',
      erro?.mensagem ?? 'Não foi possível falar com o assistente agora.',
      erro?.detalhes ?? [],
    );
  }

  const leitor = resposta.body.pipeThrough(new TextDecoderStream()).getReader();
  let pendente = '';
  while (true) {
    const { done, value } = await leitor.read();
    if (done) break;
    pendente += value;
    // Cada evento termina com uma linha em branco.
    const blocos = pendente.split('\n\n');
    pendente = blocos.pop() ?? '';
    for (const bloco of blocos) {
      const dadosDoEvento = bloco.split('\n').find((linha) => linha.startsWith('data: '));
      if (dadosDoEvento) aoEvento(JSON.parse(dadosDoEvento.slice(6)) as EventoDoAssistente);
    }
  }
}

export function obterConversa(id: string) {
  return api<ConversaDoAssistente>(`/assistente/conversas/${id}`);
}

export interface ContatoDoChamado {
  nome?: string;
  email?: string;
  telefone?: string;
}

/** Abre o chamado de suporte técnico com a conversa (visitante informa o contato). */
export function abrirChamado(conversaId: string, contato: ContatoDoChamado = {}) {
  return api<{ numero: number; mensagem: string }>('/assistente/chamados', {
    metodo: 'POST',
    corpo: { conversaId, ...contato },
  });
}
