import { useQuery } from '@tanstack/react-query';
import { FolderOpen, LayoutDashboard, Package, Tags, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { listarUsuarios } from '../../api/admin';

export const CHAVE_PENDENTES = ['admin', 'pendentes'] as const;

/** Menu da administração: lateral no desktop, abas roláveis no celular. */
export function LayoutAdmin() {
  const pendentes = useQuery({
    queryKey: CHAVE_PENDENTES,
    queryFn: () => listarUsuarios({ status: 'PENDENTE', porPagina: 1 }),
  });
  const totalPendentes = pendentes.data?.total ?? 0;

  return (
    <div className="admin conteiner">
      <nav className="admin-menu" aria-label="Administração">
        <p className="admin-menu-titulo">Administração</p>
        <NavLink to="/admin" end>
          <LayoutDashboard aria-hidden />
          Painel
        </NavLink>
        <NavLink to="/admin/documentos">
          <FolderOpen aria-hidden />
          Documentos
        </NavLink>
        <NavLink to="/admin/usuarios">
          <Users aria-hidden />
          Usuários
          {totalPendentes > 0 && (
            <span className="admin-menu-alerta" aria-label={`${totalPendentes} aguardando aprovação`}>
              {totalPendentes}
            </span>
          )}
        </NavLink>
        <NavLink to="/admin/produtos">
          <Package aria-hidden />
          Peças
        </NavLink>
        <NavLink to="/admin/categorias">
          <Tags aria-hidden />
          Categorias
        </NavLink>
      </nav>
      <div className="admin-conteudo">
        <Outlet />
      </div>
    </div>
  );
}
