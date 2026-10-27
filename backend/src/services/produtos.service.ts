import { paraProdutoDto } from '../dtos/produtos.dto.js';
import { arquivoExiste, caminhoDoArquivo, removerArquivo, tipoDoArquivo } from '../lib/armazenamento.js';
import { camposAlterados } from '../lib/diferencas.js';
import { naoEncontrado, requisicaoInvalida } from '../lib/erros.js';
import { montarPagina } from '../lib/validacao.js';
import type { UsuarioAutenticado } from '../models/index.js';
import * as categoriasRepository from '../repositories/categorias.repository.js';
import * as produtosRepository from '../repositories/produtos.repository.js';
import type { DadosProduto, FiltrosProdutos } from '../validators/produtos.validator.js';
import { registrarEvento } from './auditoria.service.js';
import { listarPagina as listarDocumentos } from './documentos.service.js';

type ImagemRecebida = Express.Multer.File;

export async function listarProdutos(filtros: FiltrosProdutos, opcoes: { incluirInativos: boolean }) {
  const { linhas, total } = await produtosRepository.listar(filtros, opcoes);
  return montarPagina(linhas.map(paraProdutoDto), total, filtros.pagina, filtros.porPagina);
}

async function buscarOuFalhar(id: string, opcoes: { incluirInativos: boolean }) {
  const produto = await produtosRepository.buscarPorId(id, opcoes);
  if (!produto) throw naoEncontrado('Produto não encontrado.');
  return produto;
}

export async function detalharProdutoNoPortal(id: string, usuario: UsuarioAutenticado | undefined) {
  const produto = await buscarOuFalhar(id, { incluirInativos: false });
  const documentosVisiveis = await listarDocumentos({ produtoId: id, pagina: 1, porPagina: 100 }, usuario);
  return { ...paraProdutoDto(produto), documentos: documentosVisiveis.itens };
}

export async function detalharProdutoParaAdmin(id: string) {
  const produto = await buscarOuFalhar(id, { incluirInativos: true });
  const totalDocumentos = await produtosRepository.contarDocumentosRelacionados(id);
  return { ...paraProdutoDto(produto), totalDocumentos };
}

export async function obterImagem(id: string, usuario: UsuarioAutenticado | undefined) {
  const produto = await produtosRepository.buscarPorId(id, { incluirInativos: usuario?.perfil === 'ADMIN' });
  const chave = produto?.imagemChave;
  if (!chave || !(await arquivoExiste(chave))) throw naoEncontrado('Imagem não encontrada.');
  return {
    caminho: caminhoDoArquivo(chave),
    mime: tipoDoArquivo(chave)?.mime ?? 'application/octet-stream',
    publica: produto.ativo,
  };
}

export async function criarProduto(dados: DadosProduto, imagem: ImagemRecebida | undefined) {
  const { removerImagem: _ignorado, ...valores } = dados;
  await conferirCategoria(valores.categoriaId);
  const produto = await produtosRepository.inserir({ ...valores, imagemChave: imagem?.filename ?? null });
  await registrarEvento({ acao: 'PRODUTO_CRIADO', alvo: alvoDoProduto(produto), detalhes: { ativo: produto.ativo } });
  return detalharProdutoParaAdmin(produto.id);
}

export async function atualizarProduto(id: string, dados: DadosProduto, imagem: ImagemRecebida | undefined) {
  const atual = await buscarOuFalhar(id, { incluirInativos: true });
  const { removerImagem, ...valores } = dados;
  await conferirCategoria(valores.categoriaId);

  const novaChave = imagem ? imagem.filename : removerImagem ? null : atual.imagemChave;
  await produtosRepository.atualizar(id, { ...valores, imagemChave: novaChave });
  const campos = camposAlterados(atual, { ...valores, imagemChave: novaChave });
  await registrarEvento({
    acao: 'PRODUTO_ALTERADO',
    alvo: alvoDoProduto({ id, ...valores }),
    detalhes: { campos: campos.map((campo) => (campo === 'imagemChave' ? 'imagem' : campo)) },
  });

  // Só apaga a foto antiga depois que o banco confirmou a troca.
  if (atual.imagemChave && atual.imagemChave !== novaChave) await removerArquivo(atual.imagemChave);

  return detalharProdutoParaAdmin(id);
}

/** Os documentos continuam existindo; só perdem o vínculo com o produto. */
export async function excluirProduto(id: string) {
  const removido = await produtosRepository.excluir(id);
  if (!removido) throw naoEncontrado('Produto não encontrado.');
  await registrarEvento({ acao: 'PRODUTO_EXCLUIDO', alvo: alvoDoProduto({ id, ...removido }) });
  await removerArquivo(removido.imagemChave);
}

function alvoDoProduto(produto: { id: string; codigo: string; nome: string }) {
  return { tipo: 'PRODUTO' as const, id: produto.id, rotulo: `${produto.codigo} · ${produto.nome}` };
}

async function conferirCategoria(categoriaId: string | null) {
  if (categoriaId && !(await categoriasRepository.buscarPorId(categoriaId))) {
    throw requisicaoInvalida('A categoria escolhida não existe mais. Atualize a página.', [
      { campo: 'categoriaId', mensagem: 'A categoria escolhida não existe mais. Atualize a página.' },
    ]);
  }
}
