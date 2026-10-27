import { describe, expect, it } from 'vitest';
import { data, dataHora, formatoDoArquivo, numero, plural, tamanhoDeArquivo } from '../../src/lib/formatar';

describe('Datas', () => {
  it('data curta em português, sem o ponto da abreviação', () => {
    expect(data('2026-10-20T13:00:00.000Z')).toBe('20 de out de 2026');
  });

  it('data e hora no fuso do Brasil', () => {
    expect(dataHora('2026-10-27T16:43:00.000Z')).toBe('27/10/2026, 13:43');
  });

  it('traço quando não há data', () => {
    expect(data(null)).toBe('—');
    expect(dataHora(undefined)).toBe('—');
  });
});

describe('Tamanho de arquivo', () => {
  it.each([
    [512, '512 B'],
    [1024, '1 KB'],
    [2_621, '2,6 KB'],
    [10_240, '10 KB'],
    [2_726_297, '2,6 MB'],
    [157_286_400, '150 MB'],
    [3 * 1024 ** 3, '3 GB'],
  ])('%i bytes → %s', (bytes, texto) => {
    expect(tamanhoDeArquivo(bytes)).toBe(texto);
  });

  it('vazio quando o tamanho não é conhecido', () => {
    expect(tamanhoDeArquivo(null)).toBe('');
    expect(tamanhoDeArquivo(undefined)).toBe('');
  });
});

describe('Formato do arquivo', () => {
  it('extensão em maiúsculas', () => {
    expect(formatoDoArquivo('Manual de montagem.pdf')).toBe('PDF');
    expect(formatoDoArquivo('medicao.folga.mp4')).toBe('MP4');
  });

  it('"Arquivo" quando não há extensão ou nome', () => {
    expect(formatoDoArquivo('LEIA-ME')).toBe('Arquivo');
    expect(formatoDoArquivo(null)).toBe('Arquivo');
  });
});

describe('Números e plural', () => {
  it('separador de milhar brasileiro', () => {
    expect(numero(2527)).toBe('2.527');
  });

  it('singular só para 1', () => {
    expect(plural(1, 'documento')).toBe('1 documento');
    expect(plural(0, 'documento')).toBe('0 documentos');
    expect(plural(3, 'peça', 'peças')).toBe('3 peças');
    expect(plural(1500, 'abertura')).toBe('1.500 aberturas');
  });
});
