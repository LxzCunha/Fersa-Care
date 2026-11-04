// TT Hoves Pro é a fonte do manual de marca, mas é comercial (TypeType): só entra se os arquivos licenciados
// estiverem em src/assets/fontes/. Sem eles, vale a Albert Sans, a alternativa livre mais próxima.
const arquivos = import.meta.glob<string>('../assets/fontes/TTHovesPro-*.woff2', {
  eager: true,
  query: '?url',
  import: 'default',
});

const PESOS: Record<string, number> = { Thin: 100, Light: 300, Regular: 400, Medium: 500, Bold: 700, Black: 900 };

export interface FaceDaFonte {
  peso: number;
  estilo: 'normal' | 'italic';
}

/** "TTHovesPro-MediumItalic.woff2" → { peso: 500, estilo: 'italic' }; nome fora do padrão → undefined. */
export function faceDoArquivo(caminho: string): FaceDaFonte | undefined {
  const variante = /TTHovesPro-(\w+?)(Italic)?\.woff2$/.exec(caminho);
  const peso = variante ? PESOS[variante[1] ?? ''] : undefined;
  if (!variante || peso === undefined) return undefined;
  return { peso, estilo: variante[2] ? 'italic' : 'normal' };
}

export function carregarFonteDaMarca() {
  for (const [caminho, endereco] of Object.entries(arquivos)) {
    const face = faceDoArquivo(caminho);
    if (!face) continue;
    document.fonts.add(
      new FontFace('TT Hoves Pro', `url(${endereco}) format('woff2')`, {
        weight: String(face.peso),
        style: face.estilo,
        display: 'swap',
      }),
    );
  }
}
