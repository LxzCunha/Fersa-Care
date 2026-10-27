import { ChevronLeft, ChevronRight } from 'lucide-react';
import { numero } from '../lib/formatar';

export function Paginacao({
  pagina,
  totalPaginas,
  total,
  aoMudar,
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  aoMudar: (pagina: number) => void;
}) {
  if (totalPaginas <= 1) return null;

  return (
    <nav className="paginacao" aria-label="Páginas de resultados">
      <button
        type="button"
        className="botao botao-secundario"
        disabled={pagina <= 1}
        onClick={() => aoMudar(pagina - 1)}
      >
        <ChevronLeft aria-hidden />
        Anterior
      </button>
      <span className="paginacao-info">
        Página {pagina} de {totalPaginas} ({numero(total)} no total)
      </span>
      <button
        type="button"
        className="botao botao-secundario"
        disabled={pagina >= totalPaginas}
        onClick={() => aoMudar(pagina + 1)}
      >
        Próxima
        <ChevronRight aria-hidden />
      </button>
    </nav>
  );
}
