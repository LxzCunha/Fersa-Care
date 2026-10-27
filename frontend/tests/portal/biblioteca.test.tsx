import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroApi } from '../../src/api/cliente';
import * as portal from '../../src/api/portal';
import { DocumentoDetalhe } from '../../src/paginas/DocumentoDetalhe';
import { Documentos } from '../../src/paginas/Documentos';
import { umaPagina, umDocumento, umUsuario } from '../fabricas';
import { renderizar } from '../renderizar';

vi.mock('../../src/api/portal');

const rotas = [
  { path: '/documentos', element: <Documentos /> },
  { path: '/documentos/:id', element: <DocumentoDetalhe /> },
];

const manual = umDocumento({ id: 'd-manual', titulo: 'Guia de montagem', capaUrl: '/api/documentos/d-manual/capa?v=1' });
const video = umDocumento({
  id: 'd-video',
  titulo: 'Como medir a folga axial',
  tipo: 'VIDEO',
  visibilidade: 'AUTENTICADO',
  arquivo: { nome: 'folga.mp4', mime: 'video/mp4', tamanho: 10_165 },
  produtos: [{ id: 'p-30205', codigo: '30205', nome: 'Rolamento', segmento: 'LEVE' }],
});

beforeEach(() => {
  vi.mocked(portal.listarDocumentos).mockResolvedValue(umaPagina([manual, video]));
});

describe('Biblioteca "Manuais e vídeos"', () => {
  it('mostra os documentos em cartões, com a contagem', async () => {
    renderizar(rotas, { caminho: '/documentos', usuario: umUsuario() });
    const grade = await screen.findByRole('list', { name: 'Resultados' });
    expect(within(grade).getAllByRole('listitem')).toHaveLength(2);
    expect(within(grade).getByRole('link', { name: 'Guia de montagem' })).toHaveAttribute('href', '/documentos/d-manual');
    expect(within(grade).getByText('Exclusivo para clientes')).toBeInTheDocument();
    expect(screen.getByText('2 documentos')).toBeInTheDocument();
  });

  it('visitante é avisado de que vê só os materiais públicos', async () => {
    renderizar(rotas, { caminho: '/documentos' });
    expect(await screen.findByText(/Você está vendo os materiais públicos/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entre com sua conta' })).toHaveAttribute('href', '/entrar?voltar=/documentos');
  });

  it('o tipo escolhido filtra pela URL', async () => {
    const { pessoa, endereco } = renderizar(rotas, { caminho: '/documentos', usuario: umUsuario() });
    await screen.findByRole('list', { name: 'Resultados' });
    await pessoa.click(screen.getByRole('button', { name: 'Vídeos' }));
    expect(endereco()).toBe('/documentos?tipo=VIDEO');
    await waitFor(() => expect(portal.listarDocumentos).toHaveBeenLastCalledWith(expect.objectContaining({ tipo: 'VIDEO' })));
    expect(screen.getByRole('button', { name: 'Vídeos' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('a busca vinda do cabeçalho aparece no resumo', async () => {
    renderizar(rotas, { caminho: '/documentos?busca=folga', usuario: umUsuario() });
    expect(await screen.findByText(/2 resultados para/)).toHaveTextContent('2 resultados para “folga”');
    expect(portal.listarDocumentos).toHaveBeenCalledWith(expect.objectContaining({ busca: 'folga' }));
  });

  it('sem resultados com filtro: dica e botão para limpar', async () => {
    vi.mocked(portal.listarDocumentos).mockResolvedValue(umaPagina([]));
    const { pessoa, endereco } = renderizar(rotas, { caminho: '/documentos?busca=xyz', usuario: umUsuario() });
    expect(await screen.findByText('Nenhum documento encontrado')).toBeInTheDocument();
    await pessoa.click(screen.getByRole('button', { name: 'Limpar busca e filtros' }));
    expect(endereco()).toBe('/documentos');
  });

  it('biblioteca vazia', async () => {
    vi.mocked(portal.listarDocumentos).mockResolvedValue(umaPagina([]));
    renderizar(rotas, { caminho: '/documentos', usuario: umUsuario() });
    expect(await screen.findByText('Ainda não há documentos publicados')).toBeInTheDocument();
  });
});

describe('Página do documento', () => {
  it('PDF: pré-visualização, abrir e baixar, com os dados ao lado', async () => {
    vi.mocked(portal.detalharDocumento).mockResolvedValue(manual);
    renderizar(rotas, { caminho: '/documentos/d-manual', usuario: umUsuario() });

    expect(await screen.findByRole('heading', { level: 1, name: 'Guia de montagem' })).toBeInTheDocument();
    expect(screen.getByTitle('Pré-visualização: Guia de montagem')).toHaveAttribute('src', '/api/documentos/d-manual/arquivo');
    expect(screen.getByRole('link', { name: /Abrir PDF/ })).toHaveAttribute('href', '/api/documentos/d-manual/arquivo');
    expect(screen.getByRole('link', { name: /Baixar \(PDF, 2,6 MB\)/ })).toHaveAttribute('href', '/api/documentos/d-manual/arquivo?download=1');
    expect(screen.getByText('Formato').nextSibling).toHaveTextContent('PDF, 2,6 MB');
    expect(screen.getByText('Idioma').nextSibling).toHaveTextContent('Português');
  });

  it('vídeo: player e os códigos das peças levam à página da peça', async () => {
    vi.mocked(portal.detalharDocumento).mockResolvedValue(video);
    const { container } = renderizar(rotas, { caminho: '/documentos/d-video', usuario: umUsuario() });
    await screen.findByRole('heading', { level: 1, name: 'Como medir a folga axial' });
    expect(container.querySelector('video')).toHaveAttribute('src', '/api/documentos/d-video/arquivo');
    expect(screen.getAllByRole('link', { name: '30205' })[0]).toHaveAttribute('href', '/produtos/p-30205');
  });

  it('link do YouTube toca dentro do portal', async () => {
    vi.mocked(portal.detalharDocumento).mockResolvedValue(
      umDocumento({ id: 'd-yt', titulo: 'Vídeo no YouTube', origem: 'LINK', arquivo: null, urlExterna: 'https://www.youtube.com/watch?v=abc123' }),
    );
    renderizar(rotas, { caminho: '/documentos/d-yt', usuario: umUsuario() });
    const player = await screen.findByTitle('Vídeo no YouTube');
    expect(player.getAttribute('src')).toContain('abc123');
    expect(screen.getByRole('link', { name: /Abrir no site do vídeo/ })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abc123');
  });

  it('visitante em material exclusivo: convite para entrar', async () => {
    vi.mocked(portal.detalharDocumento).mockRejectedValue(new ErroApi(401, 'NAO_AUTENTICADO', 'Entre com sua conta.'));
    renderizar(rotas, { caminho: '/documentos/d-video' });
    expect(await screen.findByText('Este material é exclusivo para clientes')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Entrar para abrir/ })).toHaveAttribute('href', '/entrar?voltar=%2Fdocumentos%2Fd-video');
  });

  it('sem permissão ou inexistente: "Documento não encontrado"', async () => {
    vi.mocked(portal.detalharDocumento).mockRejectedValue(new ErroApi(404, 'NAO_ENCONTRADO', 'Não encontrado.'));
    renderizar(rotas, { caminho: '/documentos/outro', usuario: umUsuario() });
    expect(await screen.findByText('Documento não encontrado')).toBeInTheDocument();
  });
});
