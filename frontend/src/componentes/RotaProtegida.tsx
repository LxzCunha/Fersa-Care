import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import type { Perfil } from '../api/tipos';
import { useAutenticacao } from '../contexto/Autenticacao';
import { Carregando, EstadoVazio } from './Estados';

/**
 * Protege telas que exigem login (e, opcionalmente, perfil de administrador).
 * É só conforto de navegação: quem garante a segurança de verdade é a API,
 * que recusa qualquer requisição sem permissão.
 */
export function RotaProtegida({ perfil, children }: { perfil?: Perfil; children: ReactNode }) {
  const { usuario, carregando } = useAutenticacao();
  const local = useLocation();

  if (carregando) return <Carregando />;

  if (!usuario) {
    const voltarPara = encodeURIComponent(local.pathname + local.search);
    return <Navigate to={`/entrar?voltar=${voltarPara}`} replace />;
  }

  if (perfil && usuario.perfil !== perfil) {
    return (
      <div className="conteiner pagina">
        <EstadoVazio titulo="Esta área é só para administradores" nivel={1}>
          Se você precisa cadastrar documentos, peça acesso de administrador à equipe FERSA Care.
        </EstadoVazio>
      </div>
    );
  }

  return <>{children}</>;
}
