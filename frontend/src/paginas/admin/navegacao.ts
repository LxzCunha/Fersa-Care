import type { MouseEvent as EventoDeMouse } from 'react';
import { useLocation, useNavigate } from 'react-router';

/**
 * Navegação das telas de cadastro: a linha da lista que abre o registro, os
 * filtros guardados na URL e a janela que volta para a lista. Fica fora de
 * Cadastro.tsx, que só exporta componentes, para o Fast Refresh do Vite
 * conseguir atualizar aquelas telas sem recarregar a página.
 */

// ─── Listas ─────────────────────────────────────────────────────────────────

/**
 * Clique em qualquer ponto da linha abre o cadastro (como na referência).
 * Links e botões da linha continuam funcionando normalmente; para teclado,
 * cada linha tem um link de verdade.
 */
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

/**
 * Filtros da lista guardados na URL (dá para compartilhar e o "voltar" do
 * navegador funciona). Mudar um filtro volta para a primeira página.
 */
export function useFiltrosNaUrl(parametros: URLSearchParams, setParametros: (novos: URLSearchParams, opcoes?: { replace?: boolean }) => void) {
  return (chave: string, valor: string | undefined) => {
    const novos = new URLSearchParams(parametros);
    if (valor) novos.set(chave, valor);
    else novos.delete(chave);
    if (chave !== 'pagina') novos.delete('pagina');
    setParametros(novos, { replace: true });
  };
}

// ─── Janela de cadastro ─────────────────────────────────────────────────────

/**
 * Fecha a janela voltando para a lista com os mesmos filtros
 * (/admin/produtos/123?ativo=true → /admin/produtos?ativo=true).
 */
export function useVoltarParaLista(lista: string) {
  const navegar = useNavigate();
  const { search } = useLocation();
  return () => navegar(`${lista}${search}`);
}

/** Leva a rolagem da janela ao topo (onde fica o aviso de erro). */
export function rolarJanelaParaTopo() {
  document.querySelector('.janela-corpo')?.scrollTo({ top: 0, behavior: 'smooth' });
}
