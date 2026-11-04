import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Marca } from '../../src/componentes/Marca';
import { faceDoArquivo } from '../../src/lib/fonteDaMarca';

describe('Fonte da marca (TT Hoves Pro)', () => {
  it.each([
    ['../assets/fontes/TTHovesPro-Light.woff2', { peso: 300, estilo: 'normal' }],
    ['../assets/fontes/TTHovesPro-Regular.woff2', { peso: 400, estilo: 'normal' }],
    ['../assets/fontes/TTHovesPro-Medium.woff2', { peso: 500, estilo: 'normal' }],
    ['../assets/fontes/TTHovesPro-Bold.woff2', { peso: 700, estilo: 'normal' }],
    ['../assets/fontes/TTHovesPro-RegularItalic.woff2', { peso: 400, estilo: 'italic' }],
  ])('%s → peso e estilo', (caminho, face) => {
    expect(faceDoArquivo(caminho)).toEqual(face);
  });

  it('ignora nomes fora do padrão', () => {
    expect(faceDoArquivo('../assets/fontes/TTHovesPro-Semibold.woff2')).toBeUndefined();
    expect(faceDoArquivo('../assets/fontes/OutraFonte-Regular.woff2')).toBeUndefined();
  });
});

describe('Logotipo', () => {
  it('logotipo oficial + separador + "Care"; versão negativa para fundo escuro', () => {
    // O Vite embute SVGs pequenos como data URI: confere a cor da arte em vez do nome do arquivo.
    const corDoLogotipo = () => decodeURIComponent(screen.getByRole('img', { name: 'FERSA' }).getAttribute('src') ?? '');
    const { container, rerender } = render(<Marca />);
    expect(corDoLogotipo()).toMatch(/#003256/i);
    expect(screen.getByText('Care')).toBeInTheDocument();
    expect(container.querySelector('.marca-separador')).toHaveAttribute('aria-hidden', 'true');

    rerender(<Marca negativa />);
    expect(corDoLogotipo()).toMatch(/#FFFFFF/i);
    expect(container.querySelector('.marca')).toHaveClass('marca-negativa');
  });
});
