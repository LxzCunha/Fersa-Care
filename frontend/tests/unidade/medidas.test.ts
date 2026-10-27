import { describe, expect, it } from 'vitest';
import { escreverMedida, fichaTecnica, lerMedida, milimetros, polegadas, quilos } from '../../src/lib/medidas';
import { umProduto } from '../fabricas';

describe('Formatação das medidas (padrão brasileiro)', () => {
  it('milímetros com vírgula decimal e até 2 casas', () => {
    expect(milimetros(25)).toBe('25 mm');
    expect(milimetros(16.25)).toBe('16,25 mm');
    expect(milimetros(68.256)).toBe('68,26 mm');
  });

  it('polegadas a partir dos milímetros, com até 3 casas', () => {
    expect(polegadas(25.4)).toBe('1 pol');
    expect(polegadas(52)).toBe('2,047 pol');
  });

  it('quilos com até 3 casas', () => {
    expect(quilos(0.16)).toBe('0,16 kg');
    expect(quilos(1.1499)).toBe('1,15 kg');
    expect(quilos(2)).toBe('2 kg');
  });
});

describe('Ficha técnica da peça', () => {
  it('lista as quatro medidas na ordem do catálogo, com a polegada nas lineares', () => {
    const ficha = fichaTecnica(umProduto({ diametroInternoMm: 25, diametroExternoMm: 52, larguraMm: 16.25, pesoKg: 0.16 }));
    expect(ficha).toEqual([
      { rotulo: 'Ø interno', valor: '25 mm', equivalente: '0,984 pol' },
      { rotulo: 'Ø externo', valor: '52 mm', equivalente: '2,047 pol' },
      { rotulo: 'Largura', valor: '16,25 mm', equivalente: '0,64 pol' },
      { rotulo: 'Peso', valor: '0,16 kg' },
    ]);
  });

  it('omite as medidas que não se aplicam (kits, ferramentas)', () => {
    const ficha = fichaTecnica(umProduto({ diametroInternoMm: null, diametroExternoMm: 80, larguraMm: null, pesoKg: null }));
    expect(ficha.map((item) => item.rotulo)).toEqual(['Ø externo']);
  });

  it('fica vazia quando a peça não tem nenhuma medida', () => {
    expect(fichaTecnica(umProduto({ diametroInternoMm: null, diametroExternoMm: null, larguraMm: null, pesoKg: null }))).toEqual([]);
  });

  it('mantém medidas iguais a zero (só null some)', () => {
    expect(fichaTecnica(umProduto({ diametroInternoMm: 0, diametroExternoMm: null, larguraMm: null, pesoKg: null }))).toHaveLength(1);
  });
});

describe('Leitura das medidas digitadas no formulário', () => {
  it.each([
    ['25', 25],
    ['25,4', 25.4],
    ['25.4', 25.4],
    [' 16,25 ', 16.25],
    ['1 250', 1250],
    ['0,16', 0.16],
  ])('"%s" vira %s', (texto, numero) => {
    expect(lerMedida(texto)).toBe(numero);
  });

  it.each(['', '   ', 'abc', '25 mm', '1,2,3'])('"%s" não é uma medida (null)', (texto) => {
    expect(lerMedida(texto)).toBeNull();
  });

  it('escreve a medida salva com vírgula, e vazio quando não há', () => {
    expect(escreverMedida(25.4)).toBe('25,4');
    expect(escreverMedida(30)).toBe('30');
    expect(escreverMedida(null)).toBe('');
    expect(escreverMedida(undefined)).toBe('');
  });

  it('ler o que foi escrito devolve o mesmo número', () => {
    for (const valor of [0.16, 16.25, 68.26, 110]) expect(lerMedida(escreverMedida(valor))).toBe(valor);
  });
});
