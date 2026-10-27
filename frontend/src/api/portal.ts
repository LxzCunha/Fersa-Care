import { api } from './cliente';
import type {
  Categoria,
  Documento,
  Idioma,
  Pagina,
  Produto,
  ProdutoComDocumentos,
  ResumoBiblioteca,
  Segmento,
  TipoDocumento,
} from './tipos';

export interface FiltrosDocumentos {
  busca?: string;
  tipo?: TipoDocumento;
  segmento?: Segmento;
  idioma?: Idioma;
  produtoId?: string;
  pagina?: number;
  porPagina?: number;
}

export function listarDocumentos(filtros: FiltrosDocumentos) {
  return api<Pagina<Documento>>('/documentos', { parametros: { ...filtros } });
}

export function resumoDaBiblioteca() {
  return api<ResumoBiblioteca>('/documentos/resumo');
}

export function detalharDocumento(id: string) {
  return api<Documento>(`/documentos/${id}`);
}

export interface FiltrosProdutos {
  busca?: string;
  segmento?: Segmento;
  categoriaId?: string;
  /** Faixas de medida em mm. */
  internoMin?: number;
  internoMax?: number;
  externoMin?: number;
  externoMax?: number;
  larguraMin?: number;
  larguraMax?: number;
  pagina?: number;
  porPagina?: number;
}

export function listarProdutos(filtros: FiltrosProdutos) {
  return api<Pagina<Produto>>('/produtos', { parametros: { ...filtros } });
}

export function detalharProduto(id: string) {
  return api<ProdutoComDocumentos>(`/produtos/${id}`);
}

export function listarCategorias() {
  return api<Categoria[]>('/categorias');
}
