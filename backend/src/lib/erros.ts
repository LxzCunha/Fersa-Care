/**
 * Erro com status HTTP. Qualquer parte da API pode lançar um ErroHttp e o
 * middleware de erros (middlewares/erros.ts) transforma em resposta JSON:
 *
 *   { "erro": { "codigo": "NAO_ENCONTRADO", "mensagem": "Documento não encontrado." } }
 *
 * Equivale a lançar uma ResponseStatusException no Spring.
 */
export class ErroHttp extends Error {
  readonly status: number;
  readonly codigo: string;
  readonly detalhes?: unknown;

  constructor(status: number, codigo: string, mensagem: string, detalhes?: unknown) {
    super(mensagem);
    this.name = 'ErroHttp';
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

export function requisicaoInvalida(mensagem: string, detalhes?: unknown): ErroHttp {
  return new ErroHttp(400, 'DADOS_INVALIDOS', mensagem, detalhes);
}

export function naoAutenticado(mensagem = 'Entre com sua conta para continuar.'): ErroHttp {
  return new ErroHttp(401, 'NAO_AUTENTICADO', mensagem);
}

export function proibido(mensagem = 'Você não tem permissão para esta ação.'): ErroHttp {
  return new ErroHttp(403, 'PROIBIDO', mensagem);
}

export function naoEncontrado(mensagem = 'Recurso não encontrado.'): ErroHttp {
  return new ErroHttp(404, 'NAO_ENCONTRADO', mensagem);
}

export function conflito(mensagem: string): ErroHttp {
  return new ErroHttp(409, 'CONFLITO', mensagem);
}
