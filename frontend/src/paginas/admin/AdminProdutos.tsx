import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Outlet, useLocation, useSearchParams } from 'react-router';
import { listarCategoriasAdmin, listarProdutosAdmin } from '../../api/admin';
import type { Segmento } from '../../api/tipos';
import { ImagemPeca } from '../../componentes/CartaoPeca';
import { AvisoErro, Carregando, EstadoVazio } from '../../componentes/Estados';
import { useValorAtrasado } from '../../lib/ganchos';
import { SEGMENTOS } from '../../lib/rotulos';
import {
  Abas,
  BarraBusca,
  CabecalhoLista,
  FiltroNaBusca,
  Marcador,
  RodapeLista,
} from './Cadastro';
import { useAbrirAoClicarNaLinha, useFiltrosNaUrl } from './navegacao';

const POR_PAGINA = 25;

/** Lista de peças; o cadastro abre numa janela por cima (rotas filhas no <Outlet />). */
export function AdminProdutos() {
  const [parametros, setParametros] = useSearchParams();
  const { search } = useLocation();
  const alterar = useFiltrosNaUrl(parametros, setParametros);
  const abrirLinha = useAbrirAoClicarNaLinha();
  const [busca, setBusca] = useState('');
  const termo = useValorAtrasado(busca.trim());

  const segmento = (parametros.get('segmento') as Segmento | null) ?? undefined;
  const situacao = parametros.get('ativo') ?? undefined;
  const categoriaId = parametros.get('categoria') ?? undefined;
  const pagina = Number(parametros.get('pagina') ?? '1') || 1;

  const filtros = {
    busca: termo || undefined,
    segmento,
    categoriaId,
    ativo: situacao === undefined ? undefined : situacao === 'true',
    pagina,
    porPagina: POR_PAGINA,
  };
  const consulta = useQuery({
    queryKey: ['admin', 'produtos', filtros],
    queryFn: () => listarProdutosAdmin(filtros),
    placeholderData: keepPreviousData,
  });
  const categorias = useQuery({ queryKey: ['admin', 'categorias', ''], queryFn: () => listarCategoriasAdmin() });

  return (
    <>
      <title>Peças | Administração FERSA Care</title>

      <CabecalhoLista titulo="Peças" novo={{ para: `/admin/produtos/novo${search}`, rotulo: 'Cadastrar peça' }} />

      <Abas
        rotulo="Situação no catálogo"
        valor={situacao}
        aoMudar={(valor) => alterar('ativo', valor)}
        opcoes={[
          { rotulo: 'Todas' },
          { valor: 'true', rotulo: 'No catálogo' },
          { valor: 'false', rotulo: 'Fora do catálogo' },
        ]}
      />

      <BarraBusca
        rotulo="Buscar por código, nome ou aplicação"
        valor={busca}
        aoMudar={(texto) => {
          setBusca(texto);
          if (pagina !== 1) alterar('pagina', undefined);
        }}
      >
        <FiltroNaBusca
          rotulo="Categoria"
          rotuloTodos="Todas"
          valor={categoriaId}
          aoMudar={(valor) => alterar('categoria', valor)}
          opcoes={(categorias.data ?? []).map((categoria) => ({ valor: categoria.id, rotulo: categoria.nome }))}
        />
        <FiltroNaBusca
          rotulo="Linha"
          rotuloTodos="Todas"
          valor={segmento}
          aoMudar={(valor) => alterar('segmento', valor)}
          opcoes={(Object.keys(SEGMENTOS) as Segmento[]).map((opcao) => ({ valor: opcao, rotulo: SEGMENTOS[opcao] }))}
        />
      </BarraBusca>

      {consulta.isPending && <Carregando />}
      {consulta.isError && <AvisoErro erro={consulta.error} />}

      {consulta.data &&
        (consulta.data.total === 0 ? (
          <EstadoVazio titulo="Nenhuma peça encontrada">
            Confira a busca e os filtros, ou cadastre uma peça no “+”.
          </EstadoVazio>
        ) : (
          <>
            <table className="tabela">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="visualmente-oculto">Foto</span>
                  </th>
                  <th scope="col">Código</th>
                  <th scope="col">Nome</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Linha</th>
                  <th scope="col" className="celula-centro">
                    No catálogo
                  </th>
                  <th scope="col">
                    <span className="visualmente-oculto">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {consulta.data.itens.map((produto) => {
                  const destino = `/admin/produtos/${produto.id}${search}`;
                  return (
                    <tr key={produto.id} {...abrirLinha(destino)}>
                      <td className="celula-foto">
                        <ImagemPeca produto={produto} />
                      </td>
                      <td className="celula-principal">
                        <Link to={destino} className="codigo">
                          {produto.codigo}
                        </Link>
                      </td>
                      <td data-rotulo="Nome">{produto.nome}</td>
                      <td data-rotulo="Categoria" className="texto-suave">
                        {produto.categoria?.nome ?? '—'}
                      </td>
                      <td data-rotulo="Linha" className="texto-suave celula-curta">
                        {SEGMENTOS[produto.segmento]}
                      </td>
                      <td data-rotulo="No catálogo" className="celula-centro">
                        <Marcador marcado={produto.ativo} rotulo="No catálogo" />
                      </td>
                      <td className="celula-acoes">
                        {produto.ativo && <Link to={`/produtos/${produto.id}`}>Ver no portal</Link>}
                        <Link to={destino} aria-label={`Editar ${produto.codigo}`}>
                          Editar
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <RodapeLista
              total={consulta.data.total}
              nomes={['peça', 'peças']}
              pagina={consulta.data.pagina}
              porPagina={POR_PAGINA}
              totalPaginas={consulta.data.totalPaginas}
              aoMudar={(nova) => alterar('pagina', String(nova))}
            />
          </>
        ))}

      <Outlet />
    </>
  );
}
