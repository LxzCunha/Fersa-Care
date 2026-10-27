import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../src/api/admin';
import { ErroApi } from '../../src/api/cliente';
import { AdminProdutos } from '../../src/paginas/admin/AdminProdutos';
import { FormProduto } from '../../src/paginas/admin/FormProduto';
import { umaCategoria, umaPagina, umAdmin, umProdutoAdmin } from '../fabricas';
import { esperarJanela, renderizar } from '../renderizar';

vi.mock('../../src/api/admin');

const rotas = [
  {
    path: '/admin/produtos',
    element: <AdminProdutos />,
    children: [
      { path: 'novo', element: <FormProduto /> },
      { path: ':id', element: <FormProduto /> },
    ],
  },
];

const abrir = (caminho: string) => renderizar(rotas, { caminho, usuario: umAdmin() });

const conicos = umaCategoria({ id: 'c-conicos', nome: 'Rolamentos de Roletes Cônicos', totalProdutos: 4 });
const esferas = umaCategoria({ id: 'c-esferas', nome: 'Rolamentos de Esferas', totalProdutos: 2 });
const peca30205 = umProdutoAdmin({ id: 'p-30205', codigo: '30205', totalDocumentos: 5 });
const pecaInativa = umProdutoAdmin({
  id: 'p-inativa',
  codigo: '6205-2RS',
  nome: 'Rolamento rígido de esferas vedado',
  categoria: { id: 'c-esferas', nome: 'Rolamentos de Esferas' },
  segmento: 'INDUSTRIAL',
  ativo: false,
});

beforeEach(() => {
  vi.mocked(api.listarProdutosAdmin).mockResolvedValue(umaPagina([peca30205, pecaInativa], { porPagina: 25 }));
  vi.mocked(api.listarCategoriasAdmin).mockResolvedValue([conicos, esferas]);
  vi.mocked(api.detalharProdutoAdmin).mockResolvedValue(peca30205);
});

describe('Lista de peças', () => {
  it('mostra cada peça com código, nome, categoria, linha e se está no catálogo', async () => {
    abrir('/admin/produtos');

    const linhas = await screen.findAllByRole('row');
    const [, primeira, segunda] = linhas;
    expect(within(primeira!).getByRole('link', { name: '30205' })).toHaveAttribute('href', '/admin/produtos/p-30205');
    expect(primeira).toHaveTextContent('Rolamento de rolos cônicos');
    expect(primeira).toHaveTextContent('Rolamentos de Roletes Cônicos');
    expect(primeira).toHaveTextContent('Linha leve');
    expect(within(primeira!).getByRole('img', { name: 'No catálogo: sim' })).toBeInTheDocument();
    expect(within(primeira!).getByRole('link', { name: 'Ver no portal' })).toHaveAttribute('href', '/produtos/p-30205');

    expect(segunda).toHaveTextContent('Industrial');
    expect(within(segunda!).getByRole('img', { name: 'No catálogo: não' })).toBeInTheDocument();
    // Peça fora do catálogo não tem página no portal.
    expect(within(segunda!).queryByRole('link', { name: 'Ver no portal' })).toBeNull();

    expect(screen.getByText('2 peças')).toBeInTheDocument();
  });

  it('busca a primeira página, 25 por vez, sem filtros', async () => {
    abrir('/admin/produtos');
    await screen.findByText('30205');
    expect(api.listarProdutosAdmin).toHaveBeenCalledWith({
      busca: undefined,
      segmento: undefined,
      categoriaId: undefined,
      ativo: undefined,
      pagina: 1,
      porPagina: 25,
    });
  });

  it('aba "Fora do catálogo" filtra e fica na URL', async () => {
    const { pessoa, endereco } = abrir('/admin/produtos');
    await screen.findByText('30205');
    await pessoa.click(screen.getByRole('button', { name: 'Fora do catálogo' }));

    expect(endereco()).toBe('/admin/produtos?ativo=false');
    await waitFor(() => expect(api.listarProdutosAdmin).toHaveBeenLastCalledWith(expect.objectContaining({ ativo: false })));
    expect(screen.getByRole('button', { name: 'Fora do catálogo' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('filtros de categoria e linha vão para a URL e para a consulta', async () => {
    const { pessoa, endereco } = abrir('/admin/produtos');
    await screen.findByText('30205');
    await pessoa.selectOptions(screen.getByRole('combobox', { name: 'Categoria' }), 'c-esferas');
    await pessoa.selectOptions(screen.getByRole('combobox', { name: 'Linha' }), 'INDUSTRIAL');

    expect(endereco()).toBe('/admin/produtos?categoria=c-esferas&segmento=INDUSTRIAL');
    await waitFor(() =>
      expect(api.listarProdutosAdmin).toHaveBeenLastCalledWith(
        expect.objectContaining({ categoriaId: 'c-esferas', segmento: 'INDUSTRIAL' }),
      ),
    );
  });

  it('a busca consulta a API depois de uma pausa na digitação', async () => {
    const { pessoa } = abrir('/admin/produtos');
    await screen.findByText('30205');
    await pessoa.type(screen.getByRole('searchbox', { name: /Buscar/ }), '32008x');
    await waitFor(() => expect(api.listarProdutosAdmin).toHaveBeenLastCalledWith(expect.objectContaining({ busca: '32008x' })));
  });

  it('paginação pelo rodapé', async () => {
    vi.mocked(api.listarProdutosAdmin).mockResolvedValue(
      umaPagina([peca30205], { total: 60, porPagina: 25, totalPaginas: 3 }),
    );
    const { pessoa, endereco } = abrir('/admin/produtos');
    expect(await screen.findByText('1–25 de 60 peças')).toBeInTheDocument();
    await pessoa.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(endereco()).toBe('/admin/produtos?pagina=2');
    await waitFor(() => expect(api.listarProdutosAdmin).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 2 })));
  });

  it('sem resultados, explica o que fazer', async () => {
    vi.mocked(api.listarProdutosAdmin).mockResolvedValue(umaPagina([]));
    abrir('/admin/produtos');
    expect(await screen.findByText('Nenhuma peça encontrada')).toBeInTheDocument();
  });

  it('erro da API aparece na tela', async () => {
    vi.mocked(api.listarProdutosAdmin).mockRejectedValue(new ErroApi(500, 'ERRO_INTERNO', 'Falha ao consultar o banco.'));
    abrir('/admin/produtos');
    expect(await screen.findByText(/Falha ao consultar o banco/)).toBeInTheDocument();
  });

  it('clicar em qualquer ponto da linha abre a janela da peça, mantendo os filtros', async () => {
    const { pessoa, endereco } = abrir('/admin/produtos?ativo=true');
    await pessoa.click(await screen.findByText('Rolamento de rolos cônicos'));

    expect(endereco()).toBe('/admin/produtos/p-30205?ativo=true');
    expect(await screen.findByRole('dialog', { name: 'Peça' })).toBeInTheDocument();
    expect(api.detalharProdutoAdmin).toHaveBeenCalledWith('p-30205');
  });

  it('o "+" abre a janela de cadastro', async () => {
    const { pessoa, endereco } = abrir('/admin/produtos');
    await pessoa.click(screen.getByRole('link', { name: 'Cadastrar peça' }));
    expect(endereco()).toBe('/admin/produtos/novo');
    expect(await screen.findByRole('dialog', { name: 'Nova peça' })).toBeInTheDocument();
  });
});

describe('Cadastro de peça', () => {
  it('envia os campos, com as medidas digitadas com vírgula convertidas em número', async () => {
    vi.mocked(api.criarProduto).mockResolvedValue(umProdutoAdmin());
    const { pessoa, endereco } = abrir('/admin/produtos/novo');
    const janela = await esperarJanela('Nova peça');

    await pessoa.type(within(janela).getByLabelText('Código'), 'TESTE 0247');
    await pessoa.selectOptions(within(janela).getByLabelText('Linha'), 'PESADA');
    await pessoa.type(within(janela).getByLabelText('Nome'), 'Rolamento de rolos cônicos (polegada)');
    await waitFor(() => expect(within(janela).getByRole('option', { name: 'Rolamentos de Esferas' })).toBeInTheDocument());
    await pessoa.selectOptions(within(janela).getByLabelText(/Categoria/), 'c-esferas');
    await pessoa.type(within(janela).getByLabelText('Ø interno (mm)'), '25,4');
    await pessoa.type(within(janela).getByLabelText('Ø externo (mm)'), '68.26');
    await pessoa.type(within(janela).getByLabelText('Peso (kg)'), '0,43');
    await pessoa.type(within(janela).getByLabelText(/Aplicações/), 'Cubo de roda traseiro');
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(api.criarProduto).toHaveBeenCalledOnce());
    expect(api.criarProduto).toHaveBeenCalledWith(
      {
        codigo: 'TESTE 0247',
        nome: 'Rolamento de rolos cônicos (polegada)',
        segmento: 'PESADA',
        categoriaId: 'c-esferas',
        descricao: '',
        aplicacoes: 'Cubo de roda traseiro',
        diametroInternoMm: 25.4,
        diametroExternoMm: 68.26,
        larguraMm: null,
        pesoKg: 0.43,
        ativo: true,
        removerImagem: false,
      },
      null,
    );
    await waitFor(() => expect(endereco()).toBe('/admin/produtos'));
    expect(screen.queryByRole('dialog', { name: 'Nova peça' })).toBeNull();
    expect(await screen.findByText('Peça cadastrada.')).toBeInTheDocument();
  });

  it('medida que não é número fica marcada no campo e nada é enviado', async () => {
    const { pessoa } = abrir('/admin/produtos/novo');
    const janela = await esperarJanela('Nova peça');
    await pessoa.type(within(janela).getByLabelText('Ø interno (mm)'), '25 mm');
    await pessoa.type(within(janela).getByLabelText('Largura (mm)'), 'abc');
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));

    expect(await within(janela).findByText('Informe só o número, ex.: 25.')).toBeInTheDocument();
    expect(within(janela).getByText('Informe só o número, ex.: 16,25.')).toBeInTheDocument();
    expect(within(janela).getByLabelText('Ø interno (mm)')).toHaveAttribute('aria-invalid', 'true');
    expect(api.criarProduto).not.toHaveBeenCalled();
  });

  it('erro de validação da API aparece embaixo do campo certo', async () => {
    vi.mocked(api.criarProduto).mockRejectedValue(
      new ErroApi(400, 'DADOS_INVALIDOS', 'Dados inválidos.', [{ campo: 'codigo', mensagem: 'Informe o código da peça.' }]),
    );
    const { pessoa } = abrir('/admin/produtos/novo');
    const janela = await esperarJanela('Nova peça');
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));

    expect(await within(janela).findByText('Informe o código da peça.')).toBeInTheDocument();
    expect(within(janela).getByLabelText('Código')).toHaveAttribute('aria-invalid', 'true');
    // A janela continua aberta para corrigir.
    expect(screen.getByRole('dialog', { name: 'Nova peça' })).toBeInTheDocument();
  });

  it('código repetido (409) aparece no topo da janela', async () => {
    vi.mocked(api.criarProduto).mockRejectedValue(new ErroApi(409, 'CONFLITO', 'Já existe um produto com este código.'));
    const { pessoa } = abrir('/admin/produtos/novo');
    const janela = await esperarJanela('Nova peça');
    await pessoa.type(within(janela).getByLabelText('Código'), '30205');
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));
    expect(await within(janela).findByText(/Já existe um produto com este código/)).toBeInTheDocument();
  });

  it('envia a foto escolhida junto', async () => {
    vi.mocked(api.criarProduto).mockResolvedValue(umProdutoAdmin());
    const { pessoa } = abrir('/admin/produtos/novo');
    const janela = await esperarJanela('Nova peça');
    const foto = new File([new Uint8Array(10)], 'foto.png', { type: 'image/png' });
    await pessoa.upload(within(janela).getByLabelText('Foto da peça'), foto);
    expect(within(janela).getByText('foto.png')).toBeInTheDocument();
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(api.criarProduto).toHaveBeenCalledWith(expect.any(Object), foto));
  });
});

describe('Edição de peça', () => {
  it('abre com os dados atuais preenchidos', async () => {
    abrir('/admin/produtos/p-30205');
    const janela = await esperarJanela('Peça');
    expect(within(janela).getByLabelText('Código')).toHaveValue('30205');
    expect(within(janela).getByLabelText('Nome')).toHaveValue('Rolamento de rolos cônicos');
    expect(within(janela).getByLabelText('Largura (mm)')).toHaveValue('16,25');
    expect(within(janela).getByLabelText('Peso (kg)')).toHaveValue('0,16');
    expect(within(janela).getByRole('checkbox', { name: 'Aparece no catálogo do portal' })).toBeChecked();
    expect(within(janela).getByText('5 documentos ligados a esta peça')).toBeInTheDocument();
    expect(within(janela).getByRole('link', { name: 'Ver no portal' })).toHaveAttribute('href', '/produtos/p-30205');
  });

  it('salva as mudanças (tirar do catálogo, apagar uma medida) e volta para a lista', async () => {
    vi.mocked(api.atualizarProduto).mockResolvedValue(peca30205);
    const { pessoa, endereco } = abrir('/admin/produtos/p-30205?ativo=true');
    const janela = await esperarJanela('Peça');

    await pessoa.clear(within(janela).getByLabelText('Nome'));
    await pessoa.type(within(janela).getByLabelText('Nome'), 'Rolamento cônico 30205');
    await pessoa.clear(within(janela).getByLabelText('Peso (kg)'));
    await pessoa.click(within(janela).getByRole('checkbox', { name: 'Aparece no catálogo do portal' }));
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(api.atualizarProduto).toHaveBeenCalledOnce());
    expect(api.atualizarProduto).toHaveBeenCalledWith(
      'p-30205',
      expect.objectContaining({ nome: 'Rolamento cônico 30205', pesoKg: null, larguraMm: 16.25, ativo: false }),
      null,
    );
    await waitFor(() => expect(endereco()).toBe('/admin/produtos?ativo=true'));
    expect(await screen.findByText('Peça atualizada.')).toBeInTheDocument();
  });

  it('remover a foto atual manda removerImagem', async () => {
    vi.mocked(api.detalharProdutoAdmin).mockResolvedValue({ ...peca30205, imagemUrl: '/api/produtos/p-30205/imagem?v=1' });
    vi.mocked(api.atualizarProduto).mockResolvedValue(peca30205);
    const { pessoa } = abrir('/admin/produtos/p-30205');
    const janela = await esperarJanela('Peça');
    await pessoa.click(within(janela).getByRole('button', { name: 'Remover foto' }));
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(api.atualizarProduto).toHaveBeenCalledWith('p-30205', expect.objectContaining({ removerImagem: true }), null),
    );
  });

  it('excluir pede confirmação e depois apaga', async () => {
    vi.mocked(api.excluirProduto).mockResolvedValue(undefined);
    const { pessoa, endereco } = abrir('/admin/produtos/p-30205');
    const janela = await esperarJanela('Peça');
    await pessoa.click(within(janela).getByRole('button', { name: 'Excluir peça' }));

    const confirmacao = screen.getByRole('dialog', { name: 'Excluir esta peça?' });
    expect(confirmacao).toHaveTextContent('5 documentos continuam no portal, sem o vínculo com a peça.');
    expect(api.excluirProduto).not.toHaveBeenCalled();
    await pessoa.click(within(confirmacao).getByRole('button', { name: 'Excluir peça' }));

    await waitFor(() => expect(api.excluirProduto).toHaveBeenCalledWith('p-30205'));
    await waitFor(() => expect(endereco()).toBe('/admin/produtos'));
    expect(await screen.findByText('Peça excluída.')).toBeInTheDocument();
  });

  it('peça inexistente: a janela mostra o erro', async () => {
    vi.mocked(api.detalharProdutoAdmin).mockRejectedValue(new ErroApi(404, 'NAO_ENCONTRADO', 'Produto não encontrado.'));
    abrir('/admin/produtos/nao-existe');
    const janela = await screen.findByRole('dialog', { name: 'Peça' });
    expect(await within(janela).findByText(/Produto não encontrado/)).toBeInTheDocument();
    expect(within(janela).queryByRole('button', { name: 'Salvar' })).toBeNull();
  });

  it('"Cancelar" sem mudanças fecha e volta para a lista com os filtros', async () => {
    const { pessoa, endereco } = abrir('/admin/produtos/p-30205?categoria=c-conicos');
    const janela = await esperarJanela('Peça');
    await pessoa.click(within(janela).getByRole('button', { name: 'Cancelar' }));
    expect(endereco()).toBe('/admin/produtos?categoria=c-conicos');
  });

  it('"Cancelar" com mudanças pergunta antes de descartar', async () => {
    const { pessoa, endereco } = abrir('/admin/produtos/p-30205');
    const janela = await esperarJanela('Peça');
    await pessoa.type(within(janela).getByLabelText('Nome'), ' alterado');
    await pessoa.click(within(janela).getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByRole('dialog', { name: 'Descartar as alterações?' })).toBeInTheDocument();
    expect(endereco()).toBe('/admin/produtos/p-30205');
    await pessoa.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(endereco()).toBe('/admin/produtos');
    expect(api.atualizarProduto).not.toHaveBeenCalled();
  });
});
