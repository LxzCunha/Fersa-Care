import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CapaDocumento, CartaoDocumento, GradeDocumentos, resumoDoConteudo } from '../../src/componentes/CartaoDocumento';
import { CartaoPeca, ImagemPeca } from '../../src/componentes/CartaoPeca';
import { SeloVisibilidade } from '../../src/componentes/SeloVisibilidade';
import { umDocumento, umProduto } from '../fabricas';
import { renderizar } from '../renderizar';

describe('Cartão de peça (catálogo)', () => {
  it('mostra categoria, código, nome e a ficha com as quatro medidas', () => {
    const produto = umProduto({ codigo: '30205', nome: 'Rolamento de rolos cônicos' });
    renderizar(<CartaoPeca produto={produto} />);

    const cartao = screen.getByRole('link');
    expect(cartao).toHaveAttribute('href', `/produtos/${produto.id}`);
    expect(within(cartao).getByText('Rolamentos de Roletes Cônicos')).toBeInTheDocument();
    expect(within(cartao).getByText('30205')).toBeInTheDocument();
    expect(within(cartao).getByText('Rolamento de rolos cônicos')).toBeInTheDocument();
    expect(within(cartao).getByText('Ø interno').nextSibling).toHaveTextContent('25 mm');
    expect(within(cartao).getByText('Ø externo').nextSibling).toHaveTextContent('52 mm');
    expect(within(cartao).getByText('Largura').nextSibling).toHaveTextContent('16,25 mm');
    expect(within(cartao).getByText('Peso').nextSibling).toHaveTextContent('0,16 kg');
    expect(within(cartao).getByText(/Ver materiais técnicos/)).toBeInTheDocument();
  });

  it('sem categoria, mostra a linha da peça no lugar', () => {
    renderizar(<CartaoPeca produto={umProduto({ categoria: null, segmento: 'PESADA' })} />);
    expect(screen.getByText('Linha pesada')).toBeInTheDocument();
  });

  it('sem nenhuma medida, não mostra a ficha', () => {
    const { container } = renderizar(
      <CartaoPeca produto={umProduto({ diametroInternoMm: null, diametroExternoMm: null, larguraMm: null, pesoKg: null })} />,
    );
    expect(container.querySelector('.ficha-resumo')).toBeNull();
  });

  it('foto da peça quando existe; desenho de rolamento quando não', () => {
    const { container, unmount } = renderizar(<ImagemPeca produto={umProduto({ imagemUrl: '/api/produtos/1/imagem?v=1' })} />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/api/produtos/1/imagem?v=1');
    unmount();

    const semFoto = renderizar(<ImagemPeca produto={umProduto({ imagemUrl: null })} />);
    expect(semFoto.container.querySelector('img')).toBeNull();
    expect(semFoto.container.querySelector('svg.imagem-peca-desenho')).not.toBeNull();
  });
});

describe('Resumo do conteúdo do documento', () => {
  it('arquivo: formato e tamanho', () => {
    expect(resumoDoConteudo(umDocumento())).toBe('PDF, 2,6 MB');
  });

  it('arquivo sem tamanho conhecido: só o formato', () => {
    expect(resumoDoConteudo(umDocumento({ arquivo: { nome: 'video.mp4', mime: 'video/mp4', tamanho: null } }))).toBe('MP4');
  });

  it('link externo', () => {
    expect(resumoDoConteudo(umDocumento({ origem: 'LINK', arquivo: null, urlExterna: 'https://youtu.be/x' }))).toBe('Link externo');
  });
});

describe('Cartão de documento (biblioteca)', () => {
  it('título leva ao documento e o botão baixa o arquivo', () => {
    const documento = umDocumento({ titulo: 'Guia de montagem' });
    renderizar(<CartaoDocumento documento={documento} />);

    expect(screen.getByRole('link', { name: 'Guia de montagem' })).toHaveAttribute('href', `/documentos/${documento.id}`);
    const baixar = screen.getByRole('link', { name: 'Baixar “Guia de montagem” (PDF, 2,6 MB)' });
    expect(baixar).toHaveAttribute('href', `/api/documentos/${documento.id}/arquivo?download=1`);
    expect(baixar).toHaveAttribute('download');
    expect(screen.getByText('Manual ·', { exact: false })).toHaveTextContent('Manual · PDF, 2,6 MB');
  });

  it('link externo abre em nova aba, passando pela API (que confere a permissão)', () => {
    const documento = umDocumento({ titulo: 'Vídeo no YouTube', tipo: 'VIDEO', origem: 'LINK', arquivo: null, urlExterna: 'https://youtu.be/x' });
    renderizar(<CartaoDocumento documento={documento} />);

    const abrir = screen.getByRole('link', { name: 'Abrir “Vídeo no YouTube” em nova aba' });
    expect(abrir).toHaveAttribute('href', `/api/documentos/${documento.id}/arquivo`);
    expect(abrir).toHaveAttribute('target', '_blank');
    expect(abrir).toHaveAttribute('rel', 'noreferrer');
  });

  it('mostra até 3 códigos de peça e o "+N" do resto', () => {
    const produtos = ['30205', '30206', '32008 X', 'FXC 2041', 'UCP 205'].map((codigo, indice) => ({
      id: `p${indice}`,
      codigo,
      nome: 'Peça',
      segmento: 'LEVE' as const,
    }));
    renderizar(<CartaoDocumento documento={umDocumento({ produtos })} />);

    expect(screen.getByText('30205')).toBeInTheDocument();
    expect(screen.getByText('32008 X')).toBeInTheDocument();
    expect(screen.queryByText('FXC 2041')).toBeNull();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it.each([
    ['PUBLICO', null],
    ['AUTENTICADO', 'Exclusivo para clientes'],
    ['RESTRITO', 'Liberado para você'],
  ] as const)('visibilidade %s → selo %s', (visibilidade, selo) => {
    renderizar(<CartaoDocumento documento={umDocumento({ visibilidade })} />);
    if (selo) expect(screen.getByText(selo)).toBeInTheDocument();
    else expect(screen.queryByText(/Exclusivo|Liberado/)).toBeNull();
  });

  it('grade com rótulo e um cartão por documento', () => {
    renderizar(<GradeDocumentos documentos={[umDocumento(), umDocumento(), umDocumento()]} rotulo="Resultados" />);
    expect(within(screen.getByRole('list', { name: 'Resultados' })).getAllByRole('listitem')).toHaveLength(3);
  });
});

describe('Capa do documento', () => {
  it('mostra a miniatura da API quando existe', () => {
    const { container } = renderizar(<CapaDocumento documento={umDocumento({ capaUrl: '/api/documentos/1/capa?v=1' })} />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/api/documentos/1/capa?v=1');
    expect(container.querySelector('.capa-substituta')).toBeNull();
  });

  it('sem capa, desenha uma folha com o ícone do tipo', () => {
    const { container } = renderizar(<CapaDocumento documento={umDocumento({ capaUrl: null })} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.capa-substituta')).not.toBeNull();
    expect(container.querySelector('.capa-substituta-video')).toBeNull();
  });

  it('vídeo sem capa vira uma tela azul; com capa, ganha o botão de play', () => {
    const semCapa = renderizar(<CapaDocumento documento={umDocumento({ tipo: 'VIDEO', capaUrl: null })} />);
    expect(semCapa.container.querySelector('.capa-substituta-video')).not.toBeNull();
    semCapa.unmount();

    const comCapa = renderizar(<CapaDocumento documento={umDocumento({ tipo: 'VIDEO', capaUrl: '/capa.webp' })} />);
    expect(comCapa.container.querySelector('.capa-documento-play')).not.toBeNull();
  });

  it('se a imagem não carregar, troca pela capa desenhada', () => {
    const { container } = renderizar(<CapaDocumento documento={umDocumento({ capaUrl: '/capa-quebrada.webp' })} />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.capa-substituta')).not.toBeNull();
  });

  it('é decorativa (o título já está no cartão)', () => {
    const { container } = renderizar(<CapaDocumento documento={umDocumento()} />);
    expect(container.querySelector('.capa-documento')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Selo de visibilidade', () => {
  it('no admin, mostra o nível de todos e marca rascunho', () => {
    renderizar(<SeloVisibilidade documento={{ visibilidade: 'PUBLICO', publicado: false }} visao="admin" />);
    expect(screen.getByText('Público')).toBeInTheDocument();
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
  });

  it('no admin, publicado não mostra "Rascunho"', () => {
    renderizar(<SeloVisibilidade documento={{ visibilidade: 'RESTRITO', publicado: true }} visao="admin" />);
    expect(screen.getByText('Usuários específicos')).toBeInTheDocument();
    expect(screen.queryByText('Rascunho')).toBeNull();
  });
});
