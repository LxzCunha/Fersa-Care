import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../src/api/admin';
import { ErroApi } from '../../src/api/cliente';
import { AdminDocumentos } from '../../src/paginas/admin/AdminDocumentos';
import { FormDocumento } from '../../src/paginas/admin/FormDocumento';
import { umaPagina, umaPaginaDeUsuarios, umAdmin, umDocumentoAdmin, umProdutoAdmin, umUsuario } from '../fabricas';
import { esperarJanela, renderizar } from '../renderizar';

vi.mock('../../src/api/admin');

const rotas = [
  {
    path: '/admin/documentos',
    element: <AdminDocumentos />,
    children: [
      { path: 'novo', element: <FormDocumento /> },
      { path: ':id', element: <FormDocumento /> },
    ],
  },
];

const abrir = (caminho: string) => renderizar(rotas, { caminho, usuario: umAdmin() });

const guia = umDocumentoAdmin({
  id: 'd-guia',
  titulo: 'Guia de montagem: rolos cônicos',
  produtos: [{ id: 'p-30205', codigo: '30205', nome: 'Rolamento', segmento: 'LEVE' }],
  capaUrl: '/api/documentos/d-guia/capa?v=1',
  totalVisualizacoes: 8,
});
const rascunho = umDocumentoAdmin({
  id: 'd-rascunho',
  titulo: 'Manual de embreagem',
  visibilidade: 'AUTENTICADO',
  publicado: false,
});
const video = umDocumentoAdmin({
  id: 'd-video',
  titulo: 'Folga axial',
  tipo: 'VIDEO',
  origem: 'LINK',
  arquivo: null,
  urlExterna: 'https://youtu.be/abc',
});
const peca30205 = umProdutoAdmin({ id: 'p-30205', codigo: '30205' });
const cliente = umUsuario({ id: 'u-cliente', nome: 'Juliana Prado', email: 'distribuidor@exemplo.com' });

beforeEach(() => {
  vi.mocked(api.listarDocumentosAdmin).mockResolvedValue(umaPagina([guia, rascunho, video]));
  vi.mocked(api.detalharDocumentoAdmin).mockResolvedValue(guia);
  vi.mocked(api.listarProdutosAdmin).mockResolvedValue(umaPagina([peca30205]));
  vi.mocked(api.listarUsuarios).mockResolvedValue(umaPaginaDeUsuarios([cliente]));
});

/** "Novo documento": a janela de cadastro vazia. */
async function abrirCadastro() {
  const tela = abrir('/admin/documentos/novo');
  return { ...tela, janela: await esperarJanela('Novo documento') };
}

describe('Lista de documentos', () => {
  it('mostra título, peças, tipo, quem pode ver, se está publicado, formato e data', async () => {
    abrir('/admin/documentos');
    await screen.findByText('Guia de montagem: rolos cônicos');
    const linha = (titulo: string) => screen.getByRole('link', { name: titulo }).closest('tr')!;

    expect(linha('Guia de montagem: rolos cônicos')).toHaveTextContent('Peças 30205');
    expect(linha('Guia de montagem: rolos cônicos')).toHaveTextContent('Manual');
    expect(linha('Guia de montagem: rolos cônicos')).toHaveTextContent('Público');
    expect(linha('Guia de montagem: rolos cônicos')).toHaveTextContent('PDF, 2,6 MB');
    expect(linha('Guia de montagem: rolos cônicos')).toHaveTextContent('20 de out de 2026');
    expect(within(linha('Guia de montagem: rolos cônicos')).getByRole('img', { name: 'Publicado: sim' })).toBeInTheDocument();
    expect(within(linha('Guia de montagem: rolos cônicos')).getByRole('link', { name: 'Ver no portal' })).toHaveAttribute(
      'href',
      '/documentos/d-guia',
    );

    expect(within(linha('Manual de embreagem')).getByRole('img', { name: 'Publicado: não' })).toBeInTheDocument();
    expect(linha('Manual de embreagem')).toHaveTextContent('Clientes cadastrados');
    // Rascunho não está no portal.
    expect(within(linha('Manual de embreagem')).queryByRole('link', { name: 'Ver no portal' })).toBeNull();

    expect(linha('Folga axial')).toHaveTextContent('Link externo');
    expect(screen.getByText('3 documentos')).toBeInTheDocument();
  });

  it('abas por tipo vão para a URL e para a consulta', async () => {
    const { pessoa, endereco } = abrir('/admin/documentos');
    await screen.findByText('Folga axial');
    await pessoa.click(screen.getByRole('button', { name: 'Vídeos' }));
    expect(endereco()).toBe('/admin/documentos?tipo=VIDEO');
    await waitFor(() => expect(api.listarDocumentosAdmin).toHaveBeenLastCalledWith(expect.objectContaining({ tipo: 'VIDEO' })));
  });

  it('filtros de acesso e situação', async () => {
    const { pessoa, endereco } = abrir('/admin/documentos');
    await screen.findByText('Folga axial');
    await pessoa.selectOptions(screen.getByRole('combobox', { name: 'Quem pode ver' }), 'RESTRITO');
    await pessoa.selectOptions(screen.getByRole('combobox', { name: 'Situação' }), 'false');
    expect(endereco()).toBe('/admin/documentos?visibilidade=RESTRITO&publicado=false');
    await waitFor(() =>
      expect(api.listarDocumentosAdmin).toHaveBeenLastCalledWith(
        expect.objectContaining({ visibilidade: 'RESTRITO', publicado: false }),
      ),
    );
  });

  it('o atalho "Rascunhos" do painel chega com o filtro já escolhido', async () => {
    abrir('/admin/documentos?publicado=false');
    await screen.findByText('Folga axial');
    expect(screen.getByRole('combobox', { name: 'Situação' })).toHaveValue('false');
    expect(api.listarDocumentosAdmin).toHaveBeenCalledWith(expect.objectContaining({ publicado: false }));
  });

  it('sem documentos com os filtros', async () => {
    vi.mocked(api.listarDocumentosAdmin).mockResolvedValue(umaPagina([]));
    abrir('/admin/documentos?tipo=BOLETIM');
    expect(await screen.findByText('Nenhum documento com esses filtros')).toBeInTheDocument();
  });
});

describe('Cadastro de documento', () => {
  it('sem arquivo, não envia e marca o campo', async () => {
    const { pessoa, janela } = await abrirCadastro();
    await pessoa.type(within(janela).getByLabelText('Título'), 'Manual sem arquivo');
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));
    expect(await within(janela).findByText('Selecione o arquivo do documento.')).toBeInTheDocument();
    expect(api.criarDocumento).not.toHaveBeenCalled();
  });

  it('o título sai do nome do arquivo e vídeo já vira tipo "Vídeo"', async () => {
    const { pessoa, janela } = await abrirCadastro();
    await pessoa.upload(
      within(janela).getByLabelText('Arquivo do documento'),
      new File(['mp4'], 'medicao-da-folga_axial.mp4', { type: 'video/mp4' }),
    );
    expect(within(janela).getByLabelText('Título')).toHaveValue('Medicao da folga axial');
    expect(within(janela).getByLabelText('Tipo')).toHaveValue('VIDEO');
  });

  it('o título digitado não é trocado pelo nome do arquivo', async () => {
    const { pessoa, janela } = await abrirCadastro();
    await pessoa.type(within(janela).getByLabelText('Título'), 'Meu título');
    await pessoa.upload(within(janela).getByLabelText('Arquivo do documento'), new File(['%PDF'], 'outro-nome.pdf'));
    expect(within(janela).getByLabelText('Título')).toHaveValue('Meu título');
  });

  it('arquivo acima do limite é recusado antes do envio', async () => {
    const { pessoa, janela } = await abrirCadastro();
    const grande = new File(['x'], 'enorme.pdf', { type: 'application/pdf' });
    Object.defineProperty(grande, 'size', { value: 201 * 1024 * 1024 });
    await pessoa.upload(within(janela).getByLabelText('Arquivo do documento'), grande);
    expect(within(janela).getByText('O arquivo passa do limite de 200 MB.')).toBeInTheDocument();
    expect(within(janela).getByText('Escolher arquivo')).toBeInTheDocument();
  });

  it('envia arquivo, peça relacionada e as escolhas de acesso', async () => {
    vi.mocked(api.criarDocumento).mockResolvedValue(guia);
    const { pessoa, janela, endereco } = await abrirCadastro();
    const arquivo = new File(['%PDF'], 'guia-montagem.pdf', { type: 'application/pdf' });

    await pessoa.upload(within(janela).getByLabelText('Arquivo do documento'), arquivo);
    await pessoa.type(within(janela).getByLabelText(/Descrição/), 'Passo a passo.');
    await pessoa.selectOptions(within(janela).getByLabelText('Idioma'), 'es');
    await pessoa.click(await within(janela).findByRole('checkbox', { name: /30205/ }));
    await pessoa.click(within(janela).getByRole('radio', { name: /Público/ }));
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(api.criarDocumento).toHaveBeenCalledOnce());
    expect(api.criarDocumento).toHaveBeenCalledWith(
      {
        titulo: 'Guia montagem',
        descricao: 'Passo a passo.',
        tipo: 'MANUAL',
        idioma: 'es',
        visibilidade: 'PUBLICO',
        publicado: true,
        origem: 'ARQUIVO',
        urlExterna: null,
        produtoIds: ['p-30205'],
        usuarioIds: [],
        removerCapa: false,
      },
      { arquivo, capa: null },
      expect.any(Function),
    );
    await waitFor(() => expect(endereco()).toBe('/admin/documentos'));
    expect(await screen.findByText('Documento cadastrado.')).toBeInTheDocument();
  });

  it('link externo em vez de arquivo', async () => {
    vi.mocked(api.criarDocumento).mockResolvedValue(video);
    const { pessoa, janela } = await abrirCadastro();
    await pessoa.type(within(janela).getByLabelText('Título'), 'Vídeo da folga axial');
    await pessoa.click(within(janela).getByRole('radio', { name: /Usar um link/ }));
    await pessoa.type(within(janela).getByLabelText('Link do conteúdo'), '  https://youtu.be/abc  ');
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(api.criarDocumento).toHaveBeenCalledWith(
        expect.objectContaining({ origem: 'LINK', urlExterna: 'https://youtu.be/abc' }),
        { arquivo: null, capa: null },
        expect.any(Function),
      ),
    );
  });

  it('restrito: pede as pessoas com acesso e envia só elas', async () => {
    vi.mocked(api.criarDocumento).mockResolvedValue(guia);
    const { pessoa, janela } = await abrirCadastro();
    await pessoa.upload(within(janela).getByLabelText('Arquivo do documento'), new File(['%PDF'], 'condicoes.pdf'));
    await pessoa.click(within(janela).getByRole('radio', { name: /Usuários específicos/ }));
    expect(within(janela).getByText('Ninguém escolhido ainda: só administradores vão ver este documento.')).toBeInTheDocument();

    await pessoa.click(await within(janela).findByRole('checkbox', { name: /Juliana Prado/ }));
    expect(within(janela).getByText('1 pessoa escolhida.')).toBeInTheDocument();
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(api.criarDocumento).toHaveBeenCalledWith(
        expect.objectContaining({ visibilidade: 'RESTRITO', usuarioIds: ['u-cliente'] }),
        expect.anything(),
        expect.any(Function),
      ),
    );
  });

  it('como rascunho', async () => {
    vi.mocked(api.criarDocumento).mockResolvedValue(rascunho);
    const { pessoa, janela } = await abrirCadastro();
    await pessoa.upload(within(janela).getByLabelText('Arquivo do documento'), new File(['%PDF'], 'rascunho.pdf'));
    await pessoa.click(within(janela).getByRole('checkbox', { name: /Publicado no portal/ }));
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(api.criarDocumento).toHaveBeenCalledWith(expect.objectContaining({ publicado: false }), expect.anything(), expect.any(Function)),
    );
  });

  it('com capa própria', async () => {
    vi.mocked(api.criarDocumento).mockResolvedValue(video);
    const { pessoa, janela } = await abrirCadastro();
    const capa = new File([new Uint8Array(10)], 'miniatura.jpg', { type: 'image/jpeg' });
    await pessoa.click(within(janela).getByRole('radio', { name: /Usar um link/ }));
    await pessoa.type(within(janela).getByLabelText('Link do conteúdo'), 'https://youtu.be/abc');
    await pessoa.upload(within(janela).getByLabelText('Capa'), capa);
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(api.criarDocumento).toHaveBeenCalledWith(expect.anything(), { arquivo: null, capa }, expect.any(Function)),
    );
  });

  it('erros de campo da API ficam embaixo dos campos e o aviso resume', async () => {
    vi.mocked(api.criarDocumento).mockRejectedValue(
      new ErroApi(400, 'DADOS_INVALIDOS', 'Dados inválidos.', [{ campo: 'titulo', mensagem: 'O título precisa ter pelo menos 3 caracteres.' }]),
    );
    const { pessoa, janela } = await abrirCadastro();
    await pessoa.upload(within(janela).getByLabelText('Arquivo do documento'), new File(['%PDF'], 'ab.pdf'));
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));
    expect(await within(janela).findByText('O título precisa ter pelo menos 3 caracteres.')).toBeInTheDocument();
    expect(within(janela).getByText(/Confira os campos destacados/)).toBeInTheDocument();
  });
});

describe('Edição de documento', () => {
  it('abre preenchida, com o arquivo atual, a capa automática e os números', async () => {
    abrir('/admin/documentos/d-guia');
    const janela = await esperarJanela('Documento');
    expect(within(janela).getByLabelText('Título')).toHaveValue('Guia de montagem: rolos cônicos');
    expect(within(janela).getByLabelText('Tipo')).toHaveValue('MANUAL');
    expect(within(janela).getByRole('radio', { name: /Público/ })).toBeChecked();
    expect(within(janela).getByText('guia.pdf (2,6 MB)')).toBeInTheDocument();
    expect(within(janela).getByText(/Capa atual, gerada do arquivo/)).toBeInTheDocument();
    expect(within(janela).getByText(/Cadastrado por Administrador FERSA em 20 de out de 2026 · 8 aberturas/)).toBeInTheDocument();
    expect(within(janela).getByText('30205')).toBeInTheDocument();
    expect(within(janela).getByRole('link', { name: 'Ver no portal' })).toHaveAttribute('href', '/documentos/d-guia');
  });

  it('salvar sem trocar o arquivo não envia arquivo', async () => {
    vi.mocked(api.atualizarDocumento).mockResolvedValue(guia);
    const { pessoa } = abrir('/admin/documentos/d-guia');
    const janela = await esperarJanela('Documento');
    await pessoa.selectOptions(within(janela).getByLabelText('Tipo'), 'FICHA_TECNICA');
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(api.atualizarDocumento).toHaveBeenCalledWith(
        'd-guia',
        expect.objectContaining({ tipo: 'FICHA_TECNICA', produtoIds: ['p-30205'], origem: 'ARQUIVO' }),
        { arquivo: null, capa: null },
        expect.any(Function),
      ),
    );
    expect(await screen.findByText('Documento atualizado.')).toBeInTheDocument();
  });

  it('tirar a peça relacionada pela ficha', async () => {
    vi.mocked(api.atualizarDocumento).mockResolvedValue(guia);
    const { pessoa } = abrir('/admin/documentos/d-guia');
    const janela = await esperarJanela('Documento');
    await pessoa.click(within(janela).getByRole('button', { name: 'Remover 30205' }));
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(api.atualizarDocumento).toHaveBeenCalledWith('d-guia', expect.objectContaining({ produtoIds: [] }), expect.anything(), expect.any(Function)),
    );
  });

  it('remover a capa própria volta para a automática (removerCapa)', async () => {
    vi.mocked(api.detalharDocumentoAdmin).mockResolvedValue({ ...guia, capaPersonalizada: true });
    vi.mocked(api.atualizarDocumento).mockResolvedValue(guia);
    const { pessoa } = abrir('/admin/documentos/d-guia');
    const janela = await esperarJanela('Documento');
    expect(within(janela).queryByText(/Capa atual, gerada do arquivo/)).toBeNull();
    await pessoa.click(within(janela).getByRole('button', { name: 'Remover capa' }));
    await pessoa.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(api.atualizarDocumento).toHaveBeenCalledWith('d-guia', expect.objectContaining({ removerCapa: true }), expect.anything(), expect.any(Function)),
    );
  });

  it('documento restrito mostra quem tem acesso', async () => {
    vi.mocked(api.detalharDocumentoAdmin).mockResolvedValue({
      ...guia,
      visibilidade: 'RESTRITO',
      usuariosComAcesso: [{ id: 'u-cliente', nome: 'Juliana Prado', email: 'j@x.com', empresa: null, status: 'ATIVO' }],
    });
    abrir('/admin/documentos/d-guia');
    const janela = await esperarJanela('Documento');
    expect(within(janela).getByRole('radio', { name: /Usuários específicos/ })).toBeChecked();
    expect(within(janela).getByText('1 pessoa escolhida.')).toBeInTheDocument();
  });

  it('excluir pede confirmação e apaga', async () => {
    vi.mocked(api.excluirDocumento).mockResolvedValue(undefined);
    const { pessoa, endereco } = abrir('/admin/documentos/d-guia');
    const janela = await esperarJanela('Documento');
    await pessoa.click(within(janela).getByRole('button', { name: 'Excluir documento' }));
    const confirmacao = screen.getByRole('dialog', { name: 'Excluir este documento?' });
    expect(confirmacao).toHaveTextContent('“Guia de montagem: rolos cônicos” e o arquivo dele serão apagados.');
    await pessoa.click(within(confirmacao).getByRole('button', { name: 'Excluir documento' }));
    await waitFor(() => expect(api.excluirDocumento).toHaveBeenCalledWith('d-guia'));
    await waitFor(() => expect(endereco()).toBe('/admin/documentos'));
  });
});
