import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { listarCategoriasAdmin } from '../../api/admin';
import { AvisoErro, Carregando, EstadoVazio } from '../../componentes/Estados';
import { plural } from '../../lib/formatar';
import { useValorAtrasado } from '../../lib/ganchos';

export function AdminCategorias() {
  const [busca, setBusca] = useState('');
  const termo = useValorAtrasado(busca.trim());

  const consulta = useQuery({
    queryKey: ['admin', 'categorias', termo],
    queryFn: () => listarCategoriasAdmin(termo || undefined),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <title>Categorias | Administração FERSA Care</title>

      <header className="admin-cabecalho">
        <div>
          <h1>Categorias</h1>
          <p>Organizam o catálogo, como no site FERSA. No portal só aparecem as que têm peças no catálogo.</p>
        </div>
        <Link to="/admin/categorias/nova" className="botao botao-principal">
          <Plus aria-hidden /> Cadastrar categoria
        </Link>
      </header>

      <div className="admin-filtros">
        <label className="campo">
          <span className="campo-rotulo">Buscar</span>
          <input
            className="entrada"
            type="search"
            placeholder="Nome da categoria"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
          />
        </label>
      </div>

      {consulta.isPending && <Carregando />}
      {consulta.isError && <AvisoErro erro={consulta.error} />}

      {consulta.data &&
        (consulta.data.length === 0 ? (
          <EstadoVazio
            titulo={termo ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria cadastrada'}
            acao={
              <Link to="/admin/categorias/nova" className="botao botao-principal">
                <Plus aria-hidden /> Cadastrar categoria
              </Link>
            }
          >
            Crie categorias como “Rolamentos de Esferas” ou “Kits de Roda para Turismo” e escolha a categoria de cada peça.
          </EstadoVazio>
        ) : (
          <>
            <p className="resultado-resumo">{plural(consulta.data.length, 'categoria')}</p>
            <div className="tabela-moldura">
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
                  {consulta.data.map((categoria) => (
                    <tr key={categoria.id}>
                      <td className="celula-principal">
                        <Link to={`/admin/categorias/${categoria.id}`}>{categoria.nome}</Link>
                      </td>
                      <td data-rotulo="Descrição" className="texto-suave celula-descricao">
                        {categoria.descricao ?? '—'}
                      </td>
                      <td data-rotulo="Peças">
                        {categoria.totalProdutos > 0 ? (
                          <Link to={`/admin/produtos?categoria=${categoria.id}`}>
                            {plural(categoria.totalProdutos, 'peça', 'peças')}
                          </Link>
                        ) : (
                          <span className="texto-suave">Nenhuma</span>
                        )}
                      </td>
                      <td className="celula-acoes">
                        <Link
                          to={`/admin/categorias/${categoria.id}`}
                          className="botao botao-fantasma botao-pequeno"
                          aria-label={`Editar ${categoria.nome}`}
                        >
                          <Pencil aria-hidden /> Editar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ))}
    </>
  );
}
