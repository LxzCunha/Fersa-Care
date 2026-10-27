// O login vai num cookie httpOnly que o navegador envia sozinho: o JavaScript nunca toca no token.

export interface DetalheDeErro {
  campo: string;
  mensagem: string;
}

export class ErroApi extends Error {
  readonly status: number;
  readonly codigo: string;
  readonly detalhes: DetalheDeErro[];

  constructor(status: number, codigo: string, mensagem: string, detalhes: DetalheDeErro[] = []) {
    super(mensagem);
    this.name = 'ErroApi';
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }

  erroDoCampo(campo: string): string | undefined {
    return this.detalhes.find((detalhe) => detalhe.campo === campo)?.mensagem;
  }
}

export type CorpoDeErro = { erro?: { codigo?: string; mensagem?: string; detalhes?: DetalheDeErro[] } } | null;

export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ErroApi) return erro.message;
  return 'Não foi possível carregar. Tente novamente em instantes.';
}

interface OpcoesRequisicao {
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  corpo?: unknown;
  formulario?: FormData;
  /** Parâmetros da URL; valores vazios são ignorados. */
  parametros?: Record<string, string | number | boolean | undefined | null>;
}

export function montarUrl(caminho: string, parametros?: OpcoesRequisicao['parametros']): string {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(parametros ?? {})) {
    if (valor !== undefined && valor !== null && valor !== '') busca.set(chave, String(valor));
  }
  const texto = busca.toString();
  return `/api${caminho}${texto ? `?${texto}` : ''}`;
}

export async function api<T>(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
  const cabecalhos: Record<string, string> = { Accept: 'application/json' };
  let corpo: BodyInit | undefined;

  if (opcoes.formulario) {
    corpo = opcoes.formulario; // o navegador define o Content-Type com o "boundary"
  } else if (opcoes.corpo !== undefined) {
    cabecalhos['Content-Type'] = 'application/json';
    corpo = JSON.stringify(opcoes.corpo);
  }

  let resposta: Response;
  try {
    resposta = await fetch(montarUrl(caminho, opcoes.parametros), {
      method: opcoes.metodo ?? 'GET',
      headers: cabecalhos,
      body: corpo,
      credentials: 'same-origin',
    });
  } catch {
    throw new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão com o servidor. Verifique sua internet e tente de novo.');
  }

  if (resposta.status === 204) return undefined as T;

  const dados: unknown = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    const erro = (dados as CorpoDeErro)?.erro;
    throw new ErroApi(
      resposta.status,
      erro?.codigo ?? 'ERRO',
      erro?.mensagem ?? 'Não foi possível concluir a ação. Tente novamente.',
      erro?.detalhes ?? [],
    );
  }

  return dados as T;
}

export function urlDoArquivo(documentoId: string, opcoes: { download?: boolean } = {}): string {
  return montarUrl(`/documentos/${documentoId}/arquivo`, { download: opcoes.download ? 1 : undefined });
}
