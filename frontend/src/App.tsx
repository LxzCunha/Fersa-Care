import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { Carregando } from './componentes/Estados';
import { Layout } from './componentes/Layout';
import { RotaProtegida } from './componentes/RotaProtegida';
import { Busca } from './paginas/Busca';
import { Categorias } from './paginas/Categorias';
import { DocumentoDetalhe } from './paginas/DocumentoDetalhe';
import { Documentos } from './paginas/Documentos';
import { Entrar } from './paginas/Entrar';
import { Inicio } from './paginas/Inicio';
import { MinhaConta } from './paginas/MinhaConta';
import { NaoEncontrada } from './paginas/NaoEncontrada';
import { ProdutoDetalhe } from './paginas/ProdutoDetalhe';
import { Produtos } from './paginas/Produtos';
import { SolicitarAcesso } from './paginas/SolicitarAcesso';

/**
 * A área do administrador é carregada sob demanda: clientes no celular
 * não baixam o código das telas de gestão.
 */
const AreaAdmin = lazy(() => import('./paginas/admin/AreaAdmin'));

/**
 * Mapa de rotas do portal.
 *   Visitante: início, busca, catálogo (produtos e categorias), documentos, entrar e solicitar acesso
 *   Usuário logado: + minha conta (e documentos exclusivos nas mesmas telas)
 *   Administrador: + /admin
 */
export function App() {
  return (
    <Routes>
      {/* A administração tem a própria estrutura (menu lateral), sem o cabeçalho do portal. */}
      <Route
        path="admin/*"
        element={
          <RotaProtegida perfil="ADMIN">
            <Suspense fallback={<Carregando />}>
              <AreaAdmin />
            </Suspense>
          </RotaProtegida>
        }
      />
      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        <Route path="documentos" element={<Documentos />} />
        <Route path="documentos/:id" element={<DocumentoDetalhe />} />
        <Route path="produtos" element={<Produtos />} />
        <Route path="produtos/:id" element={<ProdutoDetalhe />} />
        <Route path="categorias" element={<Categorias />} />
        <Route path="busca" element={<Busca />} />
        <Route path="entrar" element={<Entrar />} />
        <Route path="solicitar-acesso" element={<SolicitarAcesso />} />
        <Route
          path="minha-conta"
          element={
            <RotaProtegida>
              <MinhaConta />
            </RotaProtegida>
          }
        />
        <Route path="*" element={<NaoEncontrada />} />
      </Route>
    </Routes>
  );
}
