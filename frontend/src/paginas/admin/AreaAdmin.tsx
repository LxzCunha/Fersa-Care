import { Route, Routes } from 'react-router';
import { NaoEncontrada } from '../NaoEncontrada';
import { AdminAuditoria } from './AdminAuditoria';
import { AdminCategorias } from './AdminCategorias';
import { AdminChamados } from './AdminChamados';
import { AdminDocumentos } from './AdminDocumentos';
import { AdminProdutos } from './AdminProdutos';
import { AdminUsuarios } from './AdminUsuarios';
import { FormCategoria } from './FormCategoria';
import { FormChamado } from './FormChamado';
import { FormDocumento } from './FormDocumento';
import { FormProduto } from './FormProduto';
import { FormUsuario } from './FormUsuario';
import { LayoutAdmin } from './LayoutAdmin';
import { Painel } from './Painel';
import './Admin.css';

/**
 * Rotas da área do administrador (tudo abaixo de /admin).
 * Este arquivo é carregado sob demanda (React.lazy em App.tsx).
 */
export default function AreaAdmin() {
  return (
    <Routes>
      <Route element={<LayoutAdmin />}>
        <Route index element={<Painel />} />
        {/* Os cadastros abrem numa janela por cima da lista (rotas filhas). */}
        <Route path="documentos" element={<AdminDocumentos />}>
          <Route path="novo" element={<FormDocumento />} />
          <Route path=":id" element={<FormDocumento />} />
        </Route>
        <Route path="usuarios" element={<AdminUsuarios />}>
          <Route path="novo" element={<FormUsuario />} />
          <Route path=":id" element={<FormUsuario />} />
        </Route>
        <Route path="produtos" element={<AdminProdutos />}>
          <Route path="novo" element={<FormProduto />} />
          <Route path=":id" element={<FormProduto />} />
        </Route>
        <Route path="chamados" element={<AdminChamados />}>
          <Route path=":id" element={<FormChamado />} />
        </Route>
        <Route path="categorias" element={<AdminCategorias />}>
          <Route path="nova" element={<FormCategoria />} />
          <Route path=":id" element={<FormCategoria />} />
        </Route>
        <Route path="auditoria" element={<AdminAuditoria />} />
        <Route path="*" element={<NaoEncontrada />} />
      </Route>
    </Routes>
  );
}
