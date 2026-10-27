import { env } from '../config/env.js';
import { DIMENSOES_DO_EMBEDDING } from '../models/index.js';

/**
 * Cliente dos modelos de IA, servidos pelo Ollama (rodam na própria máquina:
 * nenhuma pergunta ou documento sai do servidor).
 * - gerarEmbeddings: transforma textos em vetores para a busca por similaridade;
 * - conversar: gera a resposta do assistente, pedaço por pedaço (streaming).
 * Isolado aqui para trocar de provedor, ou simular nos testes, sem mexer nos services.
 */

export interface MensagemDoModelo {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** O Ollama não respondeu (fora do ar, modelo não baixado, tempo esgotado...). */
export class IaIndisponivel extends Error {
  constructor(mensagem: string, opcoes?: { cause?: unknown }) {
    super(mensagem, opcoes);
    this.name = 'IaIndisponivel';
  }
}

const TEMPO_DOS_EMBEDDINGS_MS = 120_000;

async function chamarOllama(caminho: string, corpo: unknown, sinal?: AbortSignal): Promise<Response> {
  let resposta: Response;
  try {
    resposta = await fetch(new URL(caminho, env.OLLAMA_URL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: sinal,
    });
  } catch (erro) {
    if (sinal?.aborted && !(sinal.reason instanceof DOMException && sinal.reason.name === 'TimeoutError')) throw erro;
    throw new IaIndisponivel(`Não foi possível falar com o Ollama em ${env.OLLAMA_URL}.`, { cause: erro });
  }
  if (!resposta.ok) {
    throw new IaIndisponivel(`O Ollama respondeu ${resposta.status}: ${(await resposta.text()).slice(0, 300)}`);
  }
  return resposta;
}

/** O Ollama está no ar? (usado ao iniciar a API, para não marcar tudo como falha à toa) */
export async function iaDisponivel(): Promise<boolean> {
  try {
    const resposta = await fetch(new URL('/api/tags', env.OLLAMA_URL), { signal: AbortSignal.timeout(3000) });
    return resposta.ok;
  } catch {
    return false;
  }
}

/** Um vetor de DIMENSOES_DO_EMBEDDING números para cada texto, na mesma ordem. */
export async function gerarEmbeddings(textos: string[]): Promise<number[][]> {
  if (textos.length === 0) return [];
  const resposta = await chamarOllama(
    '/api/embed',
    { model: env.IA_MODELO_EMBEDDING, input: textos, truncate: true },
    AbortSignal.timeout(TEMPO_DOS_EMBEDDINGS_MS),
  );
  const { embeddings } = (await resposta.json()) as { embeddings?: number[][] };
  if (!embeddings || embeddings.length !== textos.length) {
    throw new IaIndisponivel('O modelo de embeddings devolveu uma quantidade diferente de vetores.');
  }
  if (embeddings.some((vetor) => vetor.length !== DIMENSOES_DO_EMBEDDING)) {
    throw new IaIndisponivel(
      `O modelo "${env.IA_MODELO_EMBEDDING}" gera vetores de ${embeddings[0]?.length} dimensões; ` +
        `o banco espera ${DIMENSOES_DO_EMBEDDING} (bge-m3). Trocar de modelo exige migração e reindexação.`,
    );
  }
  return embeddings;
}

/**
 * Resposta do modelo de conversa, entregue aos pedaços conforme é gerada.
 * `sinal` interrompe a geração (ex.: a pessoa fechou o chat no meio da resposta).
 */
export async function* conversar(mensagens: MensagemDoModelo[], sinal?: AbortSignal): AsyncGenerator<string> {
  const resposta = await chamarOllama(
    '/api/chat',
    {
      model: env.IA_MODELO_CHAT,
      messages: mensagens,
      stream: true,
      // Mantém o modelo carregado na memória entre perguntas (carregar leva alguns segundos).
      keep_alive: '30m',
      // Temperatura baixa: respostas técnicas mais estáveis e menos "criativas".
      options: { temperature: 0.2, num_ctx: 8192 },
    },
    sinal,
  );
  if (!resposta.body) throw new IaIndisponivel('O Ollama respondeu sem conteúdo.');

  // O Ollama manda uma linha de JSON por pedaço da resposta.
  const leitor = resposta.body.pipeThrough(new TextDecoderStream()).getReader();
  let pendente = '';
  try {
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      pendente += value;
      const linhas = pendente.split('\n');
      pendente = linhas.pop() ?? '';
      for (const linha of linhas) {
        if (!linha.trim()) continue;
        const parte = JSON.parse(linha) as { message?: { content?: string }; error?: string };
        if (parte.error) throw new IaIndisponivel(parte.error);
        if (parte.message?.content) yield parte.message.content;
      }
    }
  } finally {
    leitor.releaseLock();
  }
}
