import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Outlet } from 'react-router';
import { listarCategoriasAdmin } from '../../api/admin';
import { AvisoErro, Carregando, EstadoVazio } from '../../componentes/Estados';
import { plural } from '../../lib/formatar';
import { useValorAtrasado } from '../../lib/ganchos';
import { BarraBusca, CabecalhoLista, RodapeLista } from './Cadastro';
import { useAbrirAoClicarNaLinha } from './navegacao';

export function AdminCategorias() {
  const [busca, setBusca] = useState('');
  const termo = useValorAtrasado(busca.trim());
  const abrirLinha = useAbrirAoClicarNaLinha();

  const consulta = useQuery({
    queryKey: ['admin', 'categorias', termo],
    queryFn: () => listarCategoriasAdmin(termo || undefined),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <title>Categorias | Administração FERSA Care</title>

      <CabecalhoLista titulo="Categorias" novo={{ para: '/admin/categorias/nova', rotulo: 'Cadastrar categoria' }} />

      <BarraBusca rotulo="Buscar pelo nome da categoria" valor={busca} aoMudar={setBusca} />

      {consulta.isPending && <Carregando />}
      {consulta.isError && <AvisoErro erro={consulta.error} />}

      {consulta.data &&
        (consulta.data.length === 0 ? (
          <EstadoVazio titulo={termo ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria cadastrada'}>
            Crie categorias como “Rolamentos de Esferas” no “+” e escolha a categoria de cada peça.
          </EstadoVazio>
        ) : (
          <>
            <table className="tabela">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Descrição</th>
                  <th scope="col">Peças</th>
                  <th scope="col">
                    <span className="visualmente-oculto">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {consulta.data.map((categoria) => {
                  const destino = `/admin/categorias/${categoria.id}`;
                  return (
                    <tr key={categoria.id} {...abrirLinha(destino)}>
                      <td className="celula-principal">
                        <Link to={destino}>{categoria.nome}</Link>
                      </td>
                      <td data-rotulo="Descrição" className="texto-suave celula-descricao">
                        {categoria.descricao ?? '—'}
                      </td>
                      <td data-rotulo="Peças" className="texto-suave">
                        {categoria.totalProdutos > 0 ? plural(categoria.totalProdutos, 'peça', 'peças') : 'Nenhuma'}
                      </td>
                      <td className="celula-acoes">
                        {categoria.totalProdutos > 0 && (
                          <Link to={`/admin/produtos?categoria=${categoria.id}`}>Ver peças</Link>
                        )}
                        <Link to={destino} aria-label={`Editar ${categoria.nome}`}>
                          Editar
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <RodapeLista total={consulta.data.length} nomes={['categoria', 'categorias']} />
          </>
        ))}

      <Outlet />
    </>
  );
}
