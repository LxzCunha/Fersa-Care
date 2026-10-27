/** Tipos das respostas da API (espelham os DTOs do back-end). */

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
  /** Medidas em mm (peso em kg); null quando não se aplicam à peça. */
  diametroInternoMm: number | null;
  diametroExternoMm: number | null;
  larguraMm: number | null;
  pesoKg: number | null;
  /** Endereço da foto (/api/produtos/:id/imagem?v=...), ou null sem foto. */
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
  /** Miniatura WebP para os cartões, ou null (vídeos, links e Office sem capa enviada). */
  capaUrl: string | null;
  /** A capa foi enviada pelo admin (senão, veio da 1ª página do PDF ou da imagem). */
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

// ─── Assistente técnico e chamados ──────────────────────────────────────────

/** Documento ou peça usado na resposta do assistente. */
export interface FonteDaResposta {
  tipo: 'DOCUMENTO' | 'PRODUTO';
  id: string;
  titulo: string;
  /** O número citado no texto da resposta: [1], [2]... */
  numero: number;
}

/** O que o chat mostra depois da resposta. */
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

/** Eventos que chegam enquanto a resposta é gerada. */
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
