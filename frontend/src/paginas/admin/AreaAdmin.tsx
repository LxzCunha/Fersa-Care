import { Route, Routes } from 'react-router';
import { NaoEncontrada } from '../NaoEncontrada';
import { AdminCategorias } from './AdminCategorias';
import { AdminDocumentos } from './AdminDocumentos';
import { AdminProdutos } from './AdminProdutos';
import { AdminUsuarios } from './AdminUsuarios';
import { FormCategoria } from './FormCategoria';
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
        <Route path="documentos" element={<AdminDocumentos />} />
        <Route path="documentos/novo" element={<FormDocumento />} />
        <Route path="documentos/:id" element={<FormDocumento />} />
        <Route path="usuarios" element={<AdminUsuarios />} />
        <Route path="usuarios/novo" element={<FormUsuario />} />
        <Route path="usuarios/:id" element={<FormUsuario />} />
        <Route path="produtos" element={<AdminProdutos />} />
        <Route path="produtos/novo" element={<FormProduto />} />
        <Route path="produtos/:id" element={<FormProduto />} />
        <Route path="categorias" element={<AdminCategorias />} />
        <Route path="categorias/nova" element={<FormCategoria />} />
        <Route path="categorias/:id" element={<FormCategoria />} />
        <Route path="*" element={<NaoEncontrada />} />
      </Route>
    </Routes>
  );
}
