import { Lock, PencilLine, UserCheck } from 'lucide-react';
import type { Documento } from '../api/tipos';
import { VISIBILIDADES } from '../lib/rotulos';

/**
 * Mostra quem pode ver um documento, sempre com ícone + texto.
 * - No portal (clientes): só aparece nos materiais exclusivos.
 * - Na administração: aparece em todos, com o nome técnico do nível.
 */
export function SeloVisibilidade({
  documento,
  visao,
}: {
  documento: Pick<Documento, 'visibilidade' | 'publicado'>;
  visao: 'portal' | 'admin';
}) {
  if (visao === 'admin') {
    const info = VISIBILIDADES[documento.visibilidade];
    const Icone = info.icone;
    return (
      <>
        <span className={`selo ${info.classe}`}>
          <Icone aria-hidden />
          {info.rotulo}
        </span>
        {!documento.publicado && (
          <span className="selo selo-rascunho">
            <PencilLine aria-hidden />
            Rascunho
          </span>
        )}
      </>
    );
  }

  if (documento.visibilidade === 'AUTENTICADO') {
    return (
      <span className="selo selo-clientes">
        <UserCheck aria-hidden />
        Exclusivo para clientes
      </span>
    );
  }
  if (documento.visibilidade === 'RESTRITO') {
    return (
      <span className="selo selo-restrito">
        <Lock aria-hidden />
        Liberado para você
      </span>
    );
  }
  return null;
}
