import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import type { Perfil } from '../api/tipos';
import { useAutenticacao } from '../contexto/Autenticacao';
import { Carregando, EstadoVazio } from './Estados';

/** Só conforto de navegação: quem garante a segurança é a API, que recusa requisições sem permissão. */
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
        <EstadoVazio
          titulo="Esta área é só para administradores"
          nivel={1}
          acao={
            <Link to="/" className="botao botao-secundario">
              Voltar para o portal
            </Link>
          }
        >
          Se você precisa cadastrar documentos, peça acesso de administrador à equipe FERSA Care.
        </EstadoVazio>
      </div>
    );
  }

  return <>{children}</>;
}
