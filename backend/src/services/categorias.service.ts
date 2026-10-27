import { camposAlterados } from '../lib/diferencas.js';
import { naoEncontrado } from '../lib/erros.js';
import * as categoriasRepository from '../repositories/categorias.repository.js';
import type { DadosCategoria, FiltrosCategorias } from '../validators/categorias.validator.js';
import { registrarEvento } from './auditoria.service.js';

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
  await registrarEvento({ acao: 'CATEGORIA_CRIADA', alvo: { tipo: 'CATEGORIA', id: categoria.id, rotulo: categoria.nome } });
  return detalharCategoria(categoria.id);
}

export async function atualizarCategoria(id: string, dados: DadosCategoria) {
  const atual = await detalharCategoria(id);
  const categoria = await categoriasRepository.atualizar(id, dados);
  if (!categoria) throw naoEncontrado('Categoria não encontrada.');
  await registrarEvento({
    acao: 'CATEGORIA_ALTERADA',
    alvo: { tipo: 'CATEGORIA', id, rotulo: categoria.nome },
    detalhes: { campos: camposAlterados(atual, dados) },
  });
  return detalharCategoria(id);
}

export async function excluirCategoria(id: string) {
  const removida = await categoriasRepository.excluir(id);
  if (!removida) throw naoEncontrado('Categoria não encontrada.');
  await registrarEvento({ acao: 'CATEGORIA_EXCLUIDA', alvo: { tipo: 'CATEGORIA', id, rotulo: removida.nome } });
}
