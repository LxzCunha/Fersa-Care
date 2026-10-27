import { naoEncontrado } from '../lib/erros.js';
import * as categoriasRepository from '../repositories/categorias.repository.js';
import type { DadosCategoria, FiltrosCategorias } from '../validators/categorias.validator.js';

/** Categorias do catálogo de peças. */

/** Categorias que aparecem no portal: só as que têm peças ativas. */
export function listarCategoriasDoPortal() {
  return categoriasRepository.listar({}, { somenteComPecasAtivas: true });
}

export function listarCategoriasParaAdmin(filtros: FiltrosCategorias) {
  return categoriasRepository.listar(filtros, { somenteComPecasAtivas: false });
}

export async function detalharCategoria(id: string) {
  const categoria = await categoriasRepository.buscarPorId(id);
  if (!categoria) throw naoEncontrado('Categoria não encontrada.');
  return categoria;
}

export async function criarCategoria(dados: DadosCategoria) {
  const categoria = await categoriasRepository.inserir(dados);
  return detalharCategoria(categoria.id);
}

export async function atualizarCategoria(id: string, dados: DadosCategoria) {
  const categoria = await categoriasRepository.atualizar(id, dados);
  if (!categoria) throw naoEncontrado('Categoria não encontrada.');
  return detalharCategoria(id);
}

/** As peças continuam no catálogo, só ficam sem categoria. */
export async function excluirCategoria(id: string) {
  const existia = await categoriasRepository.excluir(id);
  if (!existia) throw naoEncontrado('Categoria não encontrada.');
}
