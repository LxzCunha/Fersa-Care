import { useEffect, useState } from 'react';

/**
 * Devolve o valor só depois que ele para de mudar por `atraso` ms.
 * Usado nas buscas que consultam a API enquanto a pessoa digita.
 */
export function useValorAtrasado<T>(valor: T, atraso = 300): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const temporizador = window.setTimeout(() => setAtrasado(valor), atraso);
    return () => window.clearTimeout(temporizador);
  }, [valor, atraso]);
  return atrasado;
}
