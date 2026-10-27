import type {
  Categoria,
  ChamadoDetalhado,
  Documento,
  DocumentoAdmin,
  EventoDeAuditoria,
  Pagina,
  PaginaUsuarios,
  Produto,
  ProdutoAdmin,
  Usuario,
  UsuarioDetalhado,
} from '../src/api/tipos';

/**
 * Dados de exemplo no formato que a API devolve. Cada fábrica aceita só os
 * campos que importam para o teste; o resto vem preenchido.
 */

let sequencia = 0;
const proximoId = () => `00000000-0000-4000-8000-${String(++sequencia).padStart(12, '0')}`;
const DATA = '2026-10-20T13:00:00.000Z';

export function umUsuario(dados: Partial<Usuario> = {}): Usuario {
  return {
    id: proximoId(),
    nome: 'Carlos Mendes',
    email: 'carlos@exemplo.com',
    empresa: 'Auto Center Exemplo',
    telefone: null,
    perfil: 'USUARIO',
    status: 'ATIVO',
    ultimoAcessoEm: null,
    criadoEm: DATA,
    atualizadoEm: DATA,
    ...dados,
  };
}

export const umAdmin = (dados: Partial<Usuario> = {}) =>
  umUsuario({ nome: 'Administrador FERSA', email: 'admin@fersacare.com.br', perfil: 'ADMIN', ...dados });

export function umUsuarioDetalhado(dados: Partial<UsuarioDetalhado> = {}): UsuarioDetalhado {
  return { ...umUsuario(), documentosLiberados: [], ...dados };
}

export function umProduto(dados: Partial<Produto> = {}): Produto {
  return {
    id: proximoId(),
    codigo: '30205',
    nome: 'Rolamento de rolos cônicos',
    segmento: 'LEVE',
    categoria: { id: 'categoria-conicos', nome: 'Rolamentos de Roletes Cônicos' },
    descricao: null,
    aplicacoes: null,
    diametroInternoMm: 25,
    diametroExternoMm: 52,
    larguraMm: 16.25,
    pesoKg: 0.16,
    imagemUrl: null,
    ativo: true,
    criadoEm: DATA,
    atualizadoEm: DATA,
    ...dados,
  };
}

export function umProdutoAdmin(dados: Partial<ProdutoAdmin> = {}): ProdutoAdmin {
  return { ...umProduto(), totalDocumentos: 0, ...dados };
}

export function umaCategoria(dados: Partial<Categoria> = {}): Categoria {
  return {
    id: proximoId(),
    nome: 'Rolamentos de Esferas',
    descricao: null,
    totalProdutos: 0,
    criadoEm: DATA,
    atualizadoEm: DATA,
    ...dados,
  };
}

export function umDocumento(dados: Partial<Documento> = {}): Documento {
  return {
    id: proximoId(),
    titulo: 'Guia de montagem: rolamentos de rolos cônicos',
    descricao: null,
    tipo: 'MANUAL',
    idioma: 'pt-BR',
    visibilidade: 'PUBLICO',
    publicado: true,
    origem: 'ARQUIVO',
    arquivo: { nome: 'guia.pdf', mime: 'application/pdf', tamanho: 2_726_297 },
    urlExterna: null,
    capaUrl: null,
    capaPersonalizada: false,
    produtos: [],
    criadoEm: DATA,
    atualizadoEm: DATA,
    ...dados,
  };
}

export function umDocumentoAdmin(dados: Partial<DocumentoAdmin> = {}): DocumentoAdmin {
  return {
    ...umDocumento(),
    usuariosComAcesso: [],
    criadoPor: { id: 'admin', nome: 'Administrador FERSA' },
    totalVisualizacoes: 0,
    ...dados,
  };
}

export function umaPagina<T>(itens: T[], dados: Partial<Pagina<T>> = {}): Pagina<T> {
  return { itens, total: itens.length, pagina: 1, porPagina: 20, totalPaginas: 1, ...dados };
}

export function umaPaginaDeUsuarios(itens: Usuario[], dados: Partial<PaginaUsuarios> = {}): PaginaUsuarios {
  return {
    ...umaPagina(itens),
    porStatus: {
      PENDENTE: itens.filter((pessoa) => pessoa.status === 'PENDENTE').length,
      ATIVO: itens.filter((pessoa) => pessoa.status === 'ATIVO').length,
      INATIVO: itens.filter((pessoa) => pessoa.status === 'INATIVO').length,
    },
    ...dados,
  };
}

export function umChamado(dados: Partial<ChamadoDetalhado> = {}): ChamadoDetalhado {
  return {
    id: proximoId(),
    numero: 12,
    nome: 'Rafael Souza',
    email: 'rafael@exemplo.com',
    telefone: null,
    resumo: '• Meu cubo faz ruído depois da troca.\n• Não ajudou.',
    status: 'ABERTO',
    observacao: null,
    clienteCadastrado: false,
    criadoEm: '2026-10-27T16:43:00.000Z',
    atualizadoEm: '2026-10-27T16:43:00.000Z',
    conversa: [],
    ...dados,
  };
}

export function umEventoDeAuditoria(dados: Partial<EventoDeAuditoria> = {}): EventoDeAuditoria {
  return {
    id: proximoId(),
    acao: 'DOCUMENTO_ALTERADO',
    autor: { id: 'admin', nome: 'Administrador FERSA' },
    alvo: { tipo: 'DOCUMENTO', id: 'doc-1', rotulo: 'Boletim 12' },
    detalhes: { campos: ['titulo'] },
    ip: '201.17.4.20',
    requisicaoId: 'b7c1d2e3-0000-4000-8000-000000000001',
    criadoEm: '2026-10-27T16:43:00.000Z',
    ...dados,
  };
}

