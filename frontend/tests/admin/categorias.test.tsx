import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../src/api/admin';
import { ErroApi } from '../../src/api/cliente';
import { AdminCategorias } from '../../src/paginas/admin/AdminCategorias';
import { FormCategoria } from '../../src/paginas/admin/FormCategoria';
import { umaCategoria, umAdmin } from '../fabricas';
import { esperarJanela, renderizar } from '../renderizar';

vi.mock('../../src/api/admin');

const rotas = [
  {
    path: '/admin/categorias',
    element: <AdminCategorias />,
    children: [
      { path: 'nova', element: <FormCategoria /> },
      { path: ':id', element: <FormCategoria /> },
    ],
  },
];

const abrir = (caminho: string) => renderizar(rotas, { caminho, usuario: umAdmin() });

const esferas = umaCategoria({
  id: 'c-esferas',
  nome: 'Rolamentos de Esferas',
  descricao: 'Rígidos, vedados e blindados.',
  totalProdutos: 2,
});
const vazia = umaCategoria({ id: 'c-vazia', nome: 'Ferramentas Fersa', totalProdutos: 0 });

beforeEach(() => {
  vi.mocked(api.listarCategoriasAdmin).mockResolvedValue([vazia, esferas]);
  vi.mocked(api.detalharCategoriaAdmin).mockResolvedValue(esferas);
});

describe('Lista de categorias', () => {
  it('mostra nome, descrição e quantas peças cada uma tem', async () => {
    abrir('/admin/categorias');
    const [, primeira, segunda] = await screen.findAllByRole('row');

    expect(within(primeira!).getByRole('link', { name: 'Ferramentas Fersa' })).toHaveAttribute('href', '/admin/categorias/c-vazia');
    expect(primeira).toHaveTextContent('—');
    expect(primeira).toHaveTextContent('Nenhuma');
    expect(within(primeira!).queryByRole('link', { name: 'Ver peças' })).toBeNull();

    expect(segunda).toHaveTextContent('Rígidos, vedados e blindados.');
    expect(segunda).toHaveTextContent('2 peças');
    expect(within(segunda!).getByRole('link', { name: 'Ver peças' })).toHaveAttribute('href', '/admin/produtos?categoria=c-esferas');
    expect(screen.getByText('2 categorias')).toBeInTheDocument();
  });

  it('a busca consulta a API pelo nome', async () => {
    const { pessoa } = abrir('/admin/categorias');
    await screen.findByText('Ferramentas Fersa');
    await pessoa.type(screen.getByRole('searchbox', { name: /Buscar/ }), 'esfer');
    await waitFor(() => expect(api.listarCategoriasAdmin).toHaveBeenLastCalledWith('esfer'));
  });

  it('nenhuma categoria cadastrada', async () => {
    vi.mocked(api.listarCategoriasAdmin).mockResolvedValue([]);
    abrir('/admin/categorias');
    expect(await screen.findByText('Nenhuma categoria cadastrada')).toBeInTheDocument();
  });

  it('busca sem resultado', async () => {
    const { pessoa } = abrir('/admin/categorias');
    await screen.findByText('Ferramentas Fersa');
    vi.mocked(api.listarCategoriasAdmin).mockResolvedValue([]);
    await pessoa.type(screen.getByRole('searchbox', { name: /Buscar/ }), 'xyz');
    expect(await screen.findByText('Nenhuma categoria encontrada')).toBeInTheDocument();
  });
});

describe('Cadastro de categoria', () => {
  it('cria com nome e descrição e volta para a lista', async () => {
    vi.mocked(api.criarCategoria).mockResolvedValue(esferas);
    const { pessoa, endereco } = abrir('/admin/categorias/nova');
    const janela = await esperarJanela('Nova categoria');

    await pessoa.type(within(janela).getByLabelText('Nome'), 'Kits de Roda');
    await pessoa.type(within(janela).getByLabelText(/Descrição/), 'Kits completos de cubo.');
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(api.criarCategoria).toHaveBeenCalledWith({ nome: 'Kits de Roda', descricao: 'Kits completos de cubo.' }));
    await waitFor(() => expect(endereco()).toBe('/admin/categorias'));
    expect(await screen.findByText('Categoria cadastrada.')).toBeInTheDocument();
  });

  it('nome repetido (409) aparece no topo da janela', async () => {
    vi.mocked(api.criarCategoria).mockRejectedValue(new ErroApi(409, 'CONFLITO', 'Já existe uma categoria com este nome.'));
    const { pessoa } = abrir('/admin/categorias/nova');
    const janela = await esperarJanela('Nova categoria');
    await pessoa.type(within(janela).getByLabelText('Nome'), 'rolamentos de esferas');
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));
    expect(await within(janela).findByText(/Já existe uma categoria com este nome/)).toBeInTheDocument();
  });

  it('nome curto demais: a mensagem da API aparece no campo', async () => {
    vi.mocked(api.criarCategoria).mockRejectedValue(
      new ErroApi(400, 'DADOS_INVALIDOS', 'Dados inválidos.', [{ campo: 'nome', mensagem: 'Use pelo menos 3 caracteres.' }]),
    );
    const { pessoa } = abrir('/admin/categorias/nova');
    const janela = await esperarJanela('Nova categoria');
    await pessoa.type(within(janela).getByLabelText('Nome'), 'ab');
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));
    expect(await within(janela).findByText('Use pelo menos 3 caracteres.')).toBeInTheDocument();
    expect(within(janela).getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('Edição de categoria', () => {
  it('abre preenchida, mostra a contagem e o link para o portal', async () => {
    abrir('/admin/categorias/c-esferas');
    const janela = await esperarJanela('Categoria');
    expect(within(janela).getByLabelText('Nome')).toHaveValue('Rolamentos de Esferas');
    expect(within(janela).getByLabelText(/Descrição/)).toHaveValue('Rígidos, vedados e blindados.');
    expect(within(janela).getByText('2 peças nesta categoria')).toBeInTheDocument();
    expect(within(janela).getByRole('link', { name: 'Ver no portal' })).toHaveAttribute('href', '/produtos?categoria=c-esferas');
  });

  it('categoria sem peças não tem "Ver no portal"', async () => {
    vi.mocked(api.detalharCategoriaAdmin).mockResolvedValue(vazia);
    abrir('/admin/categorias/c-vazia');
    const janela = await esperarJanela('Categoria');
    expect(within(janela).queryByRole('link', { name: 'Ver no portal' })).toBeNull();
  });

  it('salva o nome novo', async () => {
    vi.mocked(api.atualizarCategoria).mockResolvedValue(esferas);
    const { pessoa } = abrir('/admin/categorias/c-esferas');
    const janela = await esperarJanela('Categoria');
    await pessoa.clear(within(janela).getByLabelText('Nome'));
    await pessoa.type(within(janela).getByLabelText('Nome'), 'Rolamentos Rígidos de Esferas');
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(api.atualizarCategoria).toHaveBeenCalledWith('c-esferas', {
        nome: 'Rolamentos Rígidos de Esferas',
        descricao: 'Rígidos, vedados e blindados.',
      }),
    );
    expect(await screen.findByText('Categoria atualizada.')).toBeInTheDocument();
  });

  it('excluir avisa que as peças ficam sem categoria', async () => {
    vi.mocked(api.excluirCategoria).mockResolvedValue(undefined);
    const { pessoa, endereco } = abrir('/admin/categorias/c-esferas');
    const janela = await esperarJanela('Categoria');
    await pessoa.click(within(janela).getByRole('button', { name: 'Excluir categoria' }));

    const confirmacao = screen.getByRole('dialog', { name: 'Excluir esta categoria?' });
    expect(confirmacao).toHaveTextContent('2 peças continuam no catálogo, mas sem categoria.');
    await pessoa.click(within(confirmacao).getByRole('button', { name: 'Excluir categoria' }));

    await waitFor(() => expect(api.excluirCategoria).toHaveBeenCalledWith('c-esferas'));
    await waitFor(() => expect(endereco()).toBe('/admin/categorias'));
  });

  it('falha ao excluir: avisa e mantém a janela', async () => {
    vi.mocked(api.excluirCategoria).mockRejectedValue(new ErroApi(500, 'ERRO', 'Não foi possível excluir agora.'));
    const { pessoa, endereco } = abrir('/admin/categorias/c-esferas');
    const janela = await esperarJanela('Categoria');
    await pessoa.click(within(janela).getByRole('button', { name: 'Excluir categoria' }));
    await pessoa.click(within(screen.getByRole('dialog', { name: 'Excluir esta categoria?' })).getByRole('button', { name: 'Excluir categoria' }));
    expect(await screen.findByText('Não foi possível excluir agora.')).toBeInTheDocument();
    expect(endereco()).toBe('/admin/categorias/c-esferas');
  });
});
