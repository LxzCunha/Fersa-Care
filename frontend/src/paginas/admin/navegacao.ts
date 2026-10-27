import type { MouseEvent as EventoDeMouse } from 'react';
import { useLocation, useNavigate } from 'react-router';

// Fora de Cadastro.tsx (que só exporta componentes) para o Fast Refresh do Vite funcionar lá.

/** Clique em qualquer ponto da linha abre o cadastro; para teclado, cada linha tem um link de verdade. */
export function useAbrirAoClicarNaLinha() {
  const navegar = useNavigate();
  return (destino: string) => ({
    className: 'linha-clicavel',
    onClick: (evento: EventoDeMouse) => {
      if ((evento.target as HTMLElement).closest('a, button, input, select, label')) return;
      navegar(destino);
    },
  });
}

export function useFiltrosNaUrl(parametros: URLSearchParams, setParametros: (novos: URLSearchParams, opcoes?: { replace?: boolean }) => void) {
  return (chave: string, valor: string | undefined) => {
    const novos = new URLSearchParams(parametros);
    if (valor) novos.set(chave, valor);
    else novos.delete(chave);
    if (chave !== 'pagina') novos.delete('pagina');
    setParametros(novos, { replace: true });
  };
}

export function useVoltarParaLista(lista: string) {
  const navegar = useNavigate();
  const { search } = useLocation();
  return () => navegar(`${lista}${search}`);
}

export function rolarJanelaParaTopo() {
  document.querySelector('.janela-corpo')?.scrollTo({ top: 0, behavior: 'smooth' });
}
