import { api, ErroApi } from './cliente';
import type {
  AcaoDeAuditoria,
  Categoria,
  ChamadoDetalhado,
  DocumentoAdmin,
  Documento,
  EventoDeAuditoria,
  GrupoDeAuditoria,
  Idioma,
  Pagina,
  PaginaChamados,
  PaginaUsuarios,
  Painel,
  Perfil,
  Produto,
  ProdutoAdmin,
  Segmento,
  StatusChamado,
  StatusUsuario,
  TipoDocumento,
  Usuario,
  UsuarioDetalhado,
  Visibilidade,
} from './tipos';

export function obterPainel() {
  return api<Painel>('/admin/painel');
}

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
  /** Apaga a capa enviada e volta para a automática. */
  removerCapa: boolean;
}

export interface ArquivosDocumento {
  arquivo: File | null;
  capa: File | null;
}

export function listarDocumentosAdmin(filtros: FiltrosDocumentosAdmin) {
  return api<Pagina<Documento>>('/admin/documentos', { parametros: { ...filtros } });
}

export function detalharDocumentoAdmin(id: string) {
  return api<DocumentoAdmin>(`/admin/documentos/${id}`);
}

/** O fetch ainda não informa o progresso do envio; por isso XMLHttpRequest. */
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

function salvarDocumento(
  caminho: string,
  metodo: 'POST' | 'PUT',
  dados: DadosDocumento,
  { arquivo, capa }: ArquivosDocumento,
  aoProgredir?: (percentual: number) => void,
) {
  if (!arquivo && !capa) return api<DocumentoAdmin>(caminho, { metodo, corpo: dados });
  const formulario = new FormData();
  formulario.append('dados', JSON.stringify(dados));
  if (arquivo) formulario.append('arquivo', arquivo);
  if (capa) formulario.append('capa', capa);
  return enviarComProgresso<DocumentoAdmin>(caminho, metodo, formulario, aoProgredir);
}

export function criarDocumento(
  dados: DadosDocumento,
  arquivos: ArquivosDocumento,
  aoProgredir?: (percentual: number) => void,
) {
  return salvarDocumento('/admin/documentos', 'POST', dados, arquivos, aoProgredir);
}

export function atualizarDocumento(
  id: string,
  dados: DadosDocumento,
  arquivos: ArquivosDocumento,
  aoProgredir?: (percentual: number) => void,
) {
  return salvarDocumento(`/admin/documentos/${id}`, 'PUT', dados, arquivos, aoProgredir);
}

export function excluirDocumento(id: string) {
  return api<void>(`/admin/documentos/${id}`, { metodo: 'DELETE' });
}

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
  removerImagem: boolean;
}

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

export interface DadosCategoria {
  nome: string;
  descricao: string;
}

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

export function reindexarDocumento(id: string) {
  return api<{ mensagem: string }>(`/admin/documentos/${id}/indexar`, { metodo: 'POST' });
}

export interface FiltrosChamados {
  busca?: string;
  status?: StatusChamado;
  pagina?: number;
  porPagina?: number;
}

export function listarChamados(filtros: FiltrosChamados) {
  return api<PaginaChamados>('/admin/chamados', { parametros: { ...filtros } });
}

export function detalharChamado(id: string) {
  return api<ChamadoDetalhado>(`/admin/chamados/${id}`);
}

export function atualizarChamado(id: string, dados: { status: StatusChamado; observacao: string }) {
  return api<ChamadoDetalhado>(`/admin/chamados/${id}`, { metodo: 'PATCH', corpo: dados });
}

export interface FiltrosAuditoria {
  busca?: string;
  grupo?: GrupoDeAuditoria;
  acao?: AcaoDeAuditoria;
  alvoId?: string;
  pagina?: number;
  porPagina?: number;
}

export function listarAuditoria(filtros: FiltrosAuditoria) {
  return api<Pagina<EventoDeAuditoria>>('/admin/auditoria', { parametros: { ...filtros } });
}

