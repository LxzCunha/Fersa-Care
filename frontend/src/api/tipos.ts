/** Tipos das respostas da API: espelham à mão os DTOs do back-end (mude os dois juntos). */

export type Perfil = 'ADMIN' | 'USUARIO';
export type StatusUsuario = 'PENDENTE' | 'ATIVO' | 'INATIVO';
export type Visibilidade = 'PUBLICO' | 'AUTENTICADO' | 'RESTRITO';
export type TipoDocumento =
  | 'MANUAL'
  | 'CATALOGO'
  | 'VIDEO'
  | 'TREINAMENTO'
  | 'FICHA_TECNICA'
  | 'BOLETIM'
  | 'OUTRO';
export type Segmento = 'LEVE' | 'PESADA' | 'AGRICOLA' | 'INDUSTRIAL';
export type Idioma = 'pt-BR' | 'es' | 'en';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  empresa: string | null;
  telefone: string | null;
  perfil: Perfil;
  status: StatusUsuario;
  ultimoAcessoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ProdutoResumo {
  id: string;
  codigo: string;
  nome: string;
  segmento: Segmento;
}

export interface Produto extends ProdutoResumo {
  categoria: { id: string; nome: string } | null;
  descricao: string | null;
  aplicacoes: string | null;
  diametroInternoMm: number | null;
  diametroExternoMm: number | null;
  larguraMm: number | null;
  pesoKg: number | null;
  imagemUrl: string | null;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Categoria {
  id: string;
  nome: string;
  descricao: string | null;
  /** No portal, conta só as peças do catálogo; no admin, todas. */
  totalProdutos: number;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Documento {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: TipoDocumento;
  idioma: Idioma;
  visibilidade: Visibilidade;
  publicado: boolean;
  origem: 'ARQUIVO' | 'LINK';
  arquivo: { nome: string; mime: string | null; tamanho: number | null } | null;
  urlExterna: string | null;
  capaUrl: string | null;
  capaPersonalizada: boolean;
  produtos: ProdutoResumo[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface UsuarioComAcesso {
  id: string;
  nome: string;
  email: string;
  empresa: string | null;
  status: StatusUsuario;
}

export interface DocumentoAdmin extends Documento {
  usuariosComAcesso: UsuarioComAcesso[];
  criadoPor: { id: string; nome: string } | null;
  totalVisualizacoes: number;
  /** Só no detalhe: como o documento está na base do assistente. */
  indexacao?: {
    situacao: 'INDEXADO' | 'NA_FILA' | 'FALHOU';
    indexadoEm: string | null;
    erro: string | null;
    trechos: number;
  };
}

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
}

export interface ResumoBiblioteca {
  totalDocumentos: number;
  porTipo: Record<TipoDocumento, number>;
  recentes: Documento[];
  materiaisExclusivos: number | null;
}

export interface ProdutoComDocumentos extends Produto {
  documentos: Documento[];
}

export interface ProdutoAdmin extends Produto {
  totalDocumentos: number;
}

export interface PaginaUsuarios extends Pagina<Usuario> {
  porStatus: Record<StatusUsuario, number>;
}

export interface UsuarioDetalhado extends Usuario {
  documentosLiberados: { id: string; titulo: string; tipo: TipoDocumento }[];
}

export interface Painel {
  documentos: {
    total: number;
    publicados: number;
    rascunhos: number;
    publicos: number;
    autenticados: number;
    restritos: number;
  };
  usuarios: { clientesAtivos: number; pendentes: number; inativos: number; administradores: number };
  produtos: { total: number; ativos: number };
  visualizacoes30Dias: { total: number; deVisitantes: number };
  visualizacoesPorDia: { dia: string; total: number }[];
  maisAcessados: {
    id: string;
    titulo: string;
    tipo: TipoDocumento;
    visibilidade: Visibilidade;
    visualizacoes: number;
  }[];
  solicitacoesPendentes: Usuario[];
}

export interface FonteDaResposta {
  tipo: 'DOCUMENTO' | 'PRODUTO';
  id: string;
  titulo: string;
  /** O número citado no texto da resposta: [1], [2]... */
  numero: number;
}

export type Encaminhamento = 'NENHUM' | 'SUGERIR_CHAMADO' | 'PEDIR_CONTATO' | 'CHAMADO_ABERTO';

export interface MensagemDoAssistente {
  id: string;
  papel: 'USUARIO' | 'ASSISTENTE';
  conteudo: string;
  fontes: FonteDaResposta[];
  insatisfacao: boolean;
  criadoEm: string;
}

export interface ConversaDoAssistente {
  id: string;
  mensagens: MensagemDoAssistente[];
  chamado: { numero: number } | null;
}

export type EventoDoAssistente =
  | { tipo: 'conversa'; conversaId: string }
  | { tipo: 'texto'; texto: string }
  | {
      tipo: 'fim';
      mensagemId: string;
      fontes: FonteDaResposta[];
      encaminhamento: Encaminhamento;
      chamado: { numero: number } | null;
    }
  | { tipo: 'erro'; mensagem: string };

export type StatusChamado = 'ABERTO' | 'EM_ATENDIMENTO' | 'RESOLVIDO';

export interface Chamado {
  id: string;
  numero: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  resumo: string;
  status: StatusChamado;
  observacao: string | null;
  clienteCadastrado: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ChamadoDetalhado extends Chamado {
  conversa: MensagemDoAssistente[];
}

export interface PaginaChamados extends Pagina<Chamado> {
  porStatus: Record<StatusChamado, number>;
}

// Espelha backend/src/models/auditoria.model.ts.

export type AcaoDeAuditoria =
  | 'LOGIN'
  | 'LOGIN_RECUSADO'
  | 'ACESSO_SOLICITADO'
  | 'SENHA_ALTERADA'
  | 'SESSOES_ENCERRADAS'
  | 'USUARIO_CRIADO'
  | 'USUARIO_ALTERADO'
  | 'USUARIO_STATUS_ALTERADO'
  | 'USUARIO_EXCLUIDO'
  | 'DOCUMENTO_CRIADO'
  | 'DOCUMENTO_ALTERADO'
  | 'DOCUMENTO_EXCLUIDO'
  | 'PRODUTO_CRIADO'
  | 'PRODUTO_ALTERADO'
  | 'PRODUTO_EXCLUIDO'
  | 'CATEGORIA_CRIADA'
  | 'CATEGORIA_ALTERADA'
  | 'CATEGORIA_EXCLUIDA'
  | 'CHAMADO_ALTERADO';

export type AlvoDeAuditoria = 'USUARIO' | 'DOCUMENTO' | 'PRODUTO' | 'CATEGORIA' | 'CHAMADO';

export type GrupoDeAuditoria = 'ACESSOS' | 'ALTERACOES';

export interface EventoDeAuditoria {
  id: string;
  acao: AcaoDeAuditoria;
  /** Quem fez; null em ações de visitantes (login recusado, pedido de acesso). */
  autor: { id: string | null; nome: string } | null;
  /** O registro afetado, com o título/nome que tinha no momento. */
  alvo: { tipo: AlvoDeAuditoria; id: string; rotulo: string } | null;
  detalhes: Record<string, unknown>;
  ip: string | null;
  requisicaoId: string | null;
  criadoEm: string;
}

