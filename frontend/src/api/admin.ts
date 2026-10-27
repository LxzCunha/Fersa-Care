import { api, ErroApi } from './cliente';
import type {
  Categoria,
  DocumentoAdmin,
  Documento,
  Idioma,
  Pagina,
  PaginaUsuarios,
  Painel,
  Perfil,
  Produto,
  ProdutoAdmin,
  Segmento,
  StatusUsuario,
  TipoDocumento,
  Usuario,
  UsuarioDetalhado,
  Visibilidade,
} from './tipos';

/** Chamadas da área do administrador (/api/admin). */

export function obterPainel() {
  return api<Painel>('/admin/painel');
}

// ─── Documentos ─────────────────────────────────────────────────────────────

export interface FiltrosDocumentosAdmin {
  busca?: string;
  tipo?: TipoDocumento;
  visibilidade?: Visibilidade;
  publicado?: boolean;
  pagina?: number;
  porPagina?: number;
}

export interface DadosDocumento {
  titulo: string;
  descricao: string;
  tipo: TipoDocumento;
  idioma: Idioma;
  visibilidade: Visibilidade;
  publicado: boolean;
  origem: 'ARQUIVO' | 'LINK';
  urlExterna: string | null;
  produtoIds: string[];
  usuarioIds: string[];
}

export function listarDocumentosAdmin(filtros: FiltrosDocumentosAdmin) {
  return api<Pagina<Documento>>('/admin/documentos', { parametros: { ...filtros } });
}

export function detalharDocumentoAdmin(id: string) {
  return api<DocumentoAdmin>(`/admin/documentos/${id}`);
}

/**
 * Envia o formulário com arquivo informando o progresso do upload.
 * O fetch ainda não informa progresso de envio, por isso aqui usamos XMLHttpRequest.
 */
function enviarComProgresso<T>(
  caminho: string,
  metodo: 'POST' | 'PUT',
  formulario: FormData,
  aoProgredir?: (percentual: number) => void,
): Promise<T> {
  return new Promise((resolver, rejeitar) => {
    const requisicao = new XMLHttpRequest();
    requisicao.open(metodo, `/api${caminho}`);
    requisicao.responseType = 'json';
    requisicao.setRequestHeader('Accept', 'application/json');
    requisicao.upload.onprogress = (evento) => {
      if (evento.lengthComputable) aoProgredir?.(Math.round((evento.loaded / evento.total) * 100));
    };
    requisicao.onload = () => {
      const corpo = requisicao.response as { erro?: { codigo?: string; mensagem?: string; detalhes?: [] } } | null;
      if (requisicao.status >= 200 && requisicao.status < 300) {
        resolver(corpo as T);
        return;
      }
      rejeitar(
        new ErroApi(
          requisicao.status,
          corpo?.erro?.codigo ?? 'ERRO',
          corpo?.erro?.mensagem ?? 'Não foi possível enviar o arquivo. Tente novamente.',
          corpo?.erro?.detalhes ?? [],
        ),
      );
    };
    requisicao.onerror = () =>
      rejeitar(new ErroApi(0, 'SEM_CONEXAO', 'A conexão caiu durante o envio. Tente novamente.'));
    requisicao.send(formulario);
  });
}

/**
 * Com arquivo, envia multipart: o arquivo no campo "arquivo" e os demais
 * campos em JSON no campo "dados". Sem arquivo, envia JSON normal.
 */
function salvarDocumento(
  caminho: string,
  metodo: 'POST' | 'PUT',
  dados: DadosDocumento,
  arquivo: File | null,
  aoProgredir?: (percentual: number) => void,
) {
  if (!arquivo) return api<DocumentoAdmin>(caminho, { metodo, corpo: dados });
  const formulario = new FormData();
  formulario.append('dados', JSON.stringify(dados));
  formulario.append('arquivo', arquivo);
  return enviarComProgresso<DocumentoAdmin>(caminho, metodo, formulario, aoProgredir);
}

export function criarDocumento(dados: DadosDocumento, arquivo: File | null, aoProgredir?: (percentual: number) => void) {
  return salvarDocumento('/admin/documentos', 'POST', dados, arquivo, aoProgredir);
}

export function atualizarDocumento(
  id: string,
  dados: DadosDocumento,
  arquivo: File | null,
  aoProgredir?: (percentual: number) => void,
) {
  return salvarDocumento(`/admin/documentos/${id}`, 'PUT', dados, arquivo, aoProgredir);
}

export function excluirDocumento(id: string) {
  return api<void>(`/admin/documentos/${id}`, { metodo: 'DELETE' });
}

// ─── Usuários ───────────────────────────────────────────────────────────────

export interface FiltrosUsuarios {
  busca?: string;
  status?: StatusUsuario;
  perfil?: Perfil;
  pagina?: number;
  porPagina?: number;
}

export interface DadosUsuario {
  nome: string;
  email: string;
  empresa: string;
  telefone: string;
  perfil: Perfil;
  status: StatusUsuario;
}

export function listarUsuarios(filtros: FiltrosUsuarios) {
  return api<PaginaUsuarios>('/admin/usuarios', { parametros: { ...filtros } });
}

export function detalharUsuario(id: string) {
  return api<UsuarioDetalhado>(`/admin/usuarios/${id}`);
}

export function criarUsuario(dados: DadosUsuario & { senha: string }) {
  return api<Usuario>('/admin/usuarios', { metodo: 'POST', corpo: dados });
}

export function atualizarUsuario(id: string, dados: DadosUsuario & { novaSenha?: string }) {
  return api<Usuario>(`/admin/usuarios/${id}`, { metodo: 'PUT', corpo: dados });
}

export function alterarStatusUsuario(id: string, status: StatusUsuario) {
  return api<Usuario>(`/admin/usuarios/${id}/status`, { metodo: 'PATCH', corpo: { status } });
}

export function excluirUsuario(id: string) {
  return api<void>(`/admin/usuarios/${id}`, { metodo: 'DELETE' });
}

// ─── Produtos ───────────────────────────────────────────────────────────────

export interface FiltrosProdutosAdmin {
  busca?: string;
  segmento?: Segmento;
  categoriaId?: string;
  ativo?: boolean;
  pagina?: number;
  porPagina?: number;
}

export interface DadosProduto {
  codigo: string;
  nome: string;
  segmento: Segmento;
  categoriaId: string | null;
  descricao: string;
  aplicacoes: string;
  diametroInternoMm: number | null;
  diametroExternoMm: number | null;
  larguraMm: number | null;
  pesoKg: number | null;
  ativo: boolean;
  /** Na edição: apaga a foto atual. */
  removerImagem: boolean;
}

/** Com foto nova, vai como multipart (campo "imagem" + "dados" em JSON); sem foto, JSON puro. */
function corpoDoProduto(dados: DadosProduto, imagem: File | null) {
  if (!imagem) return { corpo: dados };
  const formulario = new FormData();
  formulario.append('dados', JSON.stringify(dados));
  formulario.append('imagem', imagem);
  return { formulario };
}

export function listarProdutosAdmin(filtros: FiltrosProdutosAdmin) {
  return api<Pagina<Produto>>('/admin/produtos', { parametros: { ...filtros } });
}

export function detalharProdutoAdmin(id: string) {
  return api<ProdutoAdmin>(`/admin/produtos/${id}`);
}

export function criarProduto(dados: DadosProduto, imagem: File | null) {
  return api<ProdutoAdmin>('/admin/produtos', { metodo: 'POST', ...corpoDoProduto(dados, imagem) });
}

export function atualizarProduto(id: string, dados: DadosProduto, imagem: File | null) {
  return api<ProdutoAdmin>(`/admin/produtos/${id}`, { metodo: 'PUT', ...corpoDoProduto(dados, imagem) });
}

export function excluirProduto(id: string) {
  return api<void>(`/admin/produtos/${id}`, { metodo: 'DELETE' });
}

// ─── Categorias ─────────────────────────────────────────────────────────────

export interface DadosCategoria {
  nome: string;
  descricao: string;
}

/** Todas as categorias, com a quantidade de peças (inclusive fora do catálogo). */
export function listarCategoriasAdmin(busca?: string) {
  return api<Categoria[]>('/admin/categorias', { parametros: { busca } });
}

export function detalharCategoriaAdmin(id: string) {
  return api<Categoria>(`/admin/categorias/${id}`);
}

export function criarCategoria(dados: DadosCategoria) {
  return api<Categoria>('/admin/categorias', { metodo: 'POST', corpo: dados });
}

export function atualizarCategoria(id: string, dados: DadosCategoria) {
  return api<Categoria>(`/admin/categorias/${id}`, { metodo: 'PUT', corpo: dados });
}

export function excluirCategoria(id: string) {
  return api<void>(`/admin/categorias/${id}`, { metodo: 'DELETE' });
}
