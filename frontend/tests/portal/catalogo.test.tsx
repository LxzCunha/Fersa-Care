import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroApi } from '../../src/api/cliente';
import * as portal from '../../src/api/portal';
import { Categorias } from '../../src/paginas/Categorias';
import { ProdutoDetalhe } from '../../src/paginas/ProdutoDetalhe';
import { Produtos } from '../../src/paginas/Produtos';
import { umaCategoria, umaPagina, umDocumento, umProduto, umUsuario } from '../fabricas';
import { renderizar } from '../renderizar';

vi.mock('../../src/api/portal');

const conicos = umaCategoria({ id: 'c-conicos', nome: 'Rolamentos de Roletes Cônicos', descricao: 'Cargas combinadas.', totalProdutos: 2 });
const esferas = umaCategoria({ id: 'c-esferas', nome: 'Rolamentos de Esferas', totalProdutos: 1 });
const p30205 = umProduto({ id: 'p-30205', codigo: '30205' });
const p6205 = umProduto({
  id: 'p-6205',
  codigo: '6205-2RS',
  nome: 'Rolamento rígido de esferas vedado',
  categoria: { id: 'c-esferas', nome: 'Rolamentos de Esferas' },
  diametroInternoMm: 25,
  diametroExternoMm: 52,
  larguraMm: 15,
  pesoKg: 0.12,
});

const rotasDoCatalogo = [
  { path: '/produtos', element: <Produtos /> },
  { path: '/produtos/:id', element: <ProdutoDetalhe /> },
  { path: '/categorias', element: <Categorias /> },
];

beforeEach(() => {
  vi.mocked(portal.listarProdutos).mockResolvedValue(umaPagina([p30205, p6205]));
  vi.mocked(portal.listarCategorias).mockResolvedValue([conicos, esferas]);
});

describe('Catálogo de peças', () => {
  it('mostra um cartão por peça, com a contagem e o título "Todas as peças"', async () => {
    renderizar(rotasDoCatalogo, { caminho: '/produtos' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Todas as peças' })).toBeInTheDocument();
    const grade = (await screen.findByText('30205')).closest('ul')!;
    expect(within(grade).getAllByRole('link')).toHaveLength(2);
    expect(within(grade).getByRole('link', { name: /6205-2RS/ })).toHaveAttribute('href', '/produtos/p-6205');
    expect(screen.getByText('2 peças')).toBeInTheDocument();
  });

  it('escolher uma categoria filtra, troca o título e mostra a pílula do filtro', async () => {
    const { pessoa, endereco } = renderizar(rotasDoCatalogo, { caminho: '/produtos' });
    await screen.findByText('30205');
    await pessoa.click(screen.getAllByRole('radio', { name: /Rolamentos de Roletes Cônicos/ })[0]!);

    expect(endereco()).toBe('/produtos?categoria=c-conicos');
    await waitFor(() => expect(portal.listarProdutos).toHaveBeenLastCalledWith(expect.objectContaining({ categoriaId: 'c-conicos' })));
    expect(screen.getByRole('heading', { level: 1, name: 'Rolamentos de Roletes Cônicos' })).toBeInTheDocument();
    expect(screen.getByText('Cargas combinadas.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover filtro: Rolamentos de Roletes Cônicos' })).toBeInTheDocument();
  });

  it('a lista de categorias do filtro mostra quantas peças cada uma tem', async () => {
    renderizar(rotasDoCatalogo, { caminho: '/produtos' });
    const grupo = (await screen.findAllByRole('radiogroup', { name: 'Categoria' }))[0]!;
    await waitFor(() => expect(within(grupo).getByText('Rolamentos de Esferas')).toBeInTheDocument());
    expect(within(grupo).getByRole('radio', { name: /Todas as categorias/ })).toBeChecked();
    expect(grupo).toHaveTextContent('Rolamentos de Roletes Cônicos2');
  });

  it('filtro por medidas aceita vírgula e manda números para a API', async () => {
    const { pessoa, endereco } = renderizar(rotasDoCatalogo, { caminho: '/produtos' });
    await screen.findByText('30205');
    await pessoa.type(screen.getAllByLabelText('Ø interno mínimo')[0]!, '20,5');
    await pessoa.type(screen.getAllByLabelText('Ø interno máximo')[0]!, '30');
    await pessoa.click(screen.getAllByRole('button', { name: 'Aplicar medidas' })[0]!);

    expect(endereco()).toBe('/produtos?internoMin=20.5&internoMax=30');
    await waitFor(() =>
      expect(portal.listarProdutos).toHaveBeenLastCalledWith(expect.objectContaining({ internoMin: 20.5, internoMax: 30 })),
    );
    expect(screen.getByRole('button', { name: 'Remover filtro: Ø interno 20,5 a 30 mm' })).toBeInTheDocument();
  });

  it('remover a pílula tira o filtro', async () => {
    const { pessoa, endereco } = renderizar(rotasDoCatalogo, { caminho: '/produtos?segmento=PESADA' });
    await pessoa.click(await screen.findByRole('button', { name: 'Remover filtro: Linha pesada' }));
    expect(endereco()).toBe('/produtos');
  });

  it('sem resultados, sugere outra busca e permite limpar os filtros', async () => {
    vi.mocked(portal.listarProdutos).mockResolvedValue(umaPagina([]));
    const { pessoa, endereco } = renderizar(rotasDoCatalogo, { caminho: '/produtos?busca=xyz' });
    expect(await screen.findByText('Nenhuma peça encontrada')).toBeInTheDocument();
    await pessoa.click(screen.getByRole('button', { name: 'Limpar busca e filtros' }));
    expect(endereco()).toBe('/produtos');
  });
});

describe('Página da peça', () => {
  const comMateriais = {
    ...p30205,
    aplicacoes: 'Cubo de roda traseiro de automóveis.',
    descricao: 'Uma carreira de rolos cônicos.',
    documentos: [umDocumento({ titulo: 'Ficha técnica 30205' }), umDocumento({ titulo: 'Guia de montagem' })],
  };

  it('mostra código, nome, ficha em mm e polegadas, textos e os materiais', async () => {
    vi.mocked(portal.detalharProduto).mockResolvedValue(comMateriais);
    renderizar(rotasDoCatalogo, { caminho: '/produtos/p-30205' });

    expect(await screen.findByRole('heading', { level: 1, name: '30205' })).toBeInTheDocument();
    expect(screen.getByText('Rolamento de rolos cônicos', { selector: '.peca-nome' })).toBeInTheDocument();
    const ficha = screen.getByLabelText('Medidas principais');
    expect(ficha).toHaveTextContent('Ø interno25 mm0,984 pol');
    expect(ficha).toHaveTextContent('Peso0,16 kg');
    expect(screen.getByText('Cubo de roda traseiro de automóveis.')).toBeInTheDocument();
    expect(screen.getByText('Uma carreira de rolos cônicos.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver 2 materiais/ })).toHaveAttribute('href', '#materiais');
    const materiais = screen.getByRole('list', { name: 'Materiais da peça 30205' });
    expect(within(materiais).getAllByRole('listitem')).toHaveLength(2);
  });

  it('a trilha leva ao catálogo e à categoria da peça', async () => {
    vi.mocked(portal.detalharProduto).mockResolvedValue(comMateriais);
    renderizar(rotasDoCatalogo, { caminho: '/produtos/p-30205' });
    await screen.findByRole('heading', { level: 1, name: '30205' });
    const trilha = screen.getByRole('navigation', { name: 'Você está em' });
    expect(within(trilha).getByRole('link', { name: 'Catálogo' })).toHaveAttribute('href', '/produtos');
    expect(within(trilha).getByRole('link', { name: 'Rolamentos de Roletes Cônicos' })).toHaveAttribute(
      'href',
      '/produtos?categoria=categoria-conicos',
    );
    expect(trilha).toHaveTextContent('30205');
  });

  it('visitante vê o convite para entrar e ver materiais exclusivos', async () => {
    vi.mocked(portal.detalharProduto).mockResolvedValue({ ...comMateriais, documentos: [] });
    renderizar(rotasDoCatalogo, { caminho: '/produtos/p-30205' });
    expect(await screen.findByText('Ainda não há materiais para esta peça')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar?voltar=/produtos/p-30205');
  });

  it('cliente logado não vê o convite para entrar', async () => {
    vi.mocked(portal.detalharProduto).mockResolvedValue(comMateriais);
    renderizar(rotasDoCatalogo, { caminho: '/produtos/p-30205', usuario: umUsuario() });
    await screen.findByRole('heading', { level: 1, name: '30205' });
    expect(screen.queryByRole('link', { name: 'Entrar' })).toBeNull();
  });

  it('peça que não existe (ou saiu do catálogo): mensagem e volta ao catálogo', async () => {
    vi.mocked(portal.detalharProduto).mockRejectedValue(new ErroApi(404, 'NAO_ENCONTRADO', 'Produto não encontrado.'));
    renderizar(rotasDoCatalogo, { caminho: '/produtos/nao-existe' });
    expect(await screen.findByText('Peça não encontrada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao catálogo' })).toHaveAttribute('href', '/produtos');
  });
});

describe('Lista de categorias do portal', () => {
  it('cada categoria leva ao catálogo filtrado, com a contagem', async () => {
    renderizar(rotasDoCatalogo, { caminho: '/categorias' });
    const link = await screen.findByRole('link', { name: /Rolamentos de Roletes Cônicos/ });
    expect(link).toHaveAttribute('href', '/produtos?categoria=c-conicos');
    expect(link).toHaveTextContent('2 peças');
    expect(screen.getByRole('link', { name: /Rolamentos de Esferas/ })).toHaveTextContent('1 peça');
    expect(screen.getByRole('link', { name: /Ver todas as peças/ })).toHaveAttribute('href', '/produtos');
  });

  it('sem categorias no catálogo', async () => {
    vi.mocked(portal.listarCategorias).mockResolvedValue([]);
    renderizar(rotasDoCatalogo, { caminho: '/categorias' });
    expect(await screen.findByText('Ainda não há categorias no catálogo')).toBeInTheDocument();
  });
});
