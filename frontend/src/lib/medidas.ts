import type { Produto } from '../api/tipos';

const decimal = (casas: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas });

export function milimetros(valor: number): string {
  return `${decimal(2).format(valor)} mm`;
}

export function polegadas(valorMm: number): string {
  return `${decimal(3).format(valorMm / 25.4)} pol`;
}

export function quilos(valor: number): string {
  return `${decimal(3).format(valor)} kg`;
}

export interface ItemDaFicha {
  rotulo: string;
  valor: string;
  equivalente?: string;
}

export function fichaTecnica(produto: Produto): ItemDaFicha[] {
  const ficha: ItemDaFicha[] = [];
  const linear = (rotulo: string, valor: number | null) => {
    if (valor !== null) ficha.push({ rotulo, valor: milimetros(valor), equivalente: polegadas(valor) });
  };
  linear('Ø interno', produto.diametroInternoMm);
  linear('Ø externo', produto.diametroExternoMm);
  linear('Largura', produto.larguraMm);
  if (produto.pesoKg !== null) ficha.push({ rotulo: 'Peso', valor: quilos(produto.pesoKg) });
  return ficha;
}

export function lerMedida(texto: string): number | null {
  const normalizado = texto.trim().replace(/\s/g, '').replace(',', '.');
  if (normalizado === '') return null;
  const valor = Number(normalizado);
  return Number.isFinite(valor) ? valor : null;
}

export function escreverMedida(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '' : String(valor).replace('.', ',');
}
