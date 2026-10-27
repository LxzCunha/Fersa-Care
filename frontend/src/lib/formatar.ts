/** Formatação de valores para exibição. */

const formatoData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const formatoDataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function data(valor: string | null | undefined): string {
  return valor ? formatoData.format(new Date(valor)).replace('.', '') : '—';
}

export function dataHora(valor: string | null | undefined): string {
  return valor ? formatoDataHora.format(new Date(valor)) : '—';
}

export function tamanhoDeArquivo(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  const unidades = ['KB', 'MB', 'GB'];
  let valor = bytes / 1024;
  let indice = 0;
  while (valor >= 1024 && indice < unidades.length - 1) {
    valor /= 1024;
    indice++;
  }
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: valor < 10 ? 1 : 0 })} ${unidades[indice]}`;
}

/** "Manual de montagem.pdf" → "PDF" */
export function formatoDoArquivo(nome: string | null | undefined): string {
  const extensao = nome?.split('.').pop();
  return extensao && extensao !== nome ? extensao.toUpperCase() : 'Arquivo';
}

export function numero(valor: number): string {
  return valor.toLocaleString('pt-BR');
}

/** Plural simples: plural(1, 'documento') → "1 documento"; plural(3, ...) → "3 documentos". */
export function plural(quantidade: number, singular: string, formaPlural = `${singular}s`): string {
  return `${numero(quantidade)} ${quantidade === 1 ? singular : formaPlural}`;
}
