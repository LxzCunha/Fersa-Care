import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Outlet, useLocation, useSearchParams } from 'react-router';
import { listarDocumentosAdmin } from '../../api/admin';
import type { TipoDocumento, Visibilidade } from '../../api/tipos';
import { CapaDocumento } from '../../componentes/CartaoDocumento';
import { AvisoErro, Carregando, EstadoVazio } from '../../componentes/Estados';
import { data, resumoDoConteudo } from '../../lib/formatar';
import { useValorAtrasado } from '../../lib/ganchos';
import { ORDEM_DOS_TIPOS, TIPOS, VISIBILIDADES } from '../../lib/rotulos';
import {
  Abas,
  BarraBusca,
  CabecalhoLista,
  FiltroNaBusca,
  Marcador,
  RodapeLista,
} from './Cadastro';
import { useAbrirAoClicarNaLinha, useFiltrosNaUrl } from './navegacao';

const POR_PAGINA = 20;

/** Lista de documentos; o cadastro abre numa janela por cima (rotas filhas no <Outlet />). */
export function AdminDocumentos() {
  const [parametros, setParametros] = useSearchParams();
  const { search } = useLocation();
  const alterar = useFiltrosNaUrl(parametros, setParametros);
  const abrirLinha = useAbrirAoClicarNaLinha();
  // A busca consulta a API sozinha, depois de uma pequena pausa na digitação.
  const [busca, setBusca] = useState('');
  const buscaAtrasada = useValorAtrasado(busca.trim());

  const tipo = (parametros.get('tipo') as TipoDocumento | null) ?? undefined;
  const visibilidade = (parametros.get('visibilidade') as Visibilidade | null) ?? undefined;
  const situacao = parametros.get('publicado') ?? undefined;
  const pagina = Number(parametros.get('pagina') ?? '1') || 1;

  const filtros = {
    busca: buscaAtrasada || undefined,
    tipo,
    visibilidade,
    publicado: situacao === undefined ? undefined : situacao === 'true',
    pagina,
    porPagina: POR_PAGINA,
  };
  const consulta = useQuery({
    queryKey: ['admin', 'documentos', filtros],
    queryFn: () => listarDocumentosAdmin(filtros),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <title>Documentos | Administração FERSA Care</title>

      <CabecalhoLista titulo="Documentos" novo={{ para: `/admin/documentos/novo${search}`, rotulo: 'Cadastrar documento' }} />

      <Abas
        rotulo="Tipo de documento"
        valor={tipo}
        aoMudar={(valor) => alterar('tipo', valor)}
        opcoes={[{ rotulo: 'Todos' }, ...ORDEM_DOS_TIPOS.map((opcao) => ({ valor: opcao, rotulo: TIPOS[opcao].plural }))]}
      />

      <BarraBusca
        rotulo="Buscar por título, descrição ou código da peça"
        valor={busca}
        aoMudar={(texto) => {
          setBusca(texto);
          if (pagina !== 1) alterar('pagina', undefined);
        }}
      >
        <FiltroNaBusca
          rotulo="Quem pode ver"
          valor={visibilidade}
          aoMudar={(valor) => alterar('visibilidade', valor)}
          opcoes={(Object.keys(VISIBILIDADES) as Visibilidade[]).map((opcao) => ({
            valor: opcao,
            rotulo: VISIBILIDADES[opcao].rotulo,
          }))}
        />
        <FiltroNaBusca
          rotulo="Situação"
          rotuloTodos="Todas"
          valor={situacao}
          aoMudar={(valor) => alterar('publicado', valor)}
          opcoes={[
            { valor: 'true', rotulo: 'Publicados' },
            { valor: 'false', rotulo: 'Rascunhos' },
          ]}
        />
      </BarraBusca>

      {consulta.isPending && <Carregando />}
      {consulta.isError && <AvisoErro erro={consulta.error} />}

      {consulta.data &&
        (consulta.data.total === 0 ? (
          <EstadoVazio
            titulo={filtros.busca || tipo || visibilidade || situacao ? 'Nenhum documento com esses filtros' : 'Nenhum documento cadastrado'}
          >
            Os documentos cadastrados no “+” aparecem no portal conforme quem pode ver cada um.
          </EstadoVazio>
        ) : (
          <>
            <table className="tabela">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="visualmente-oculto">Capa</span>
                  </th>
                  <th scope="col">Título</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Quem pode ver</th>
                  <th scope="col" className="celula-centro">
                    Publicado
                  </th>
                  <th scope="col">Conteúdo</th>
                  <th scope="col">Atualizado</th>
                  <th scope="col">
                    <span className="visualmente-oculto">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {consulta.data.itens.map((documento) => {
                  const destino = `/admin/documentos/${documento.id}${search}`;
                  return (
                    <tr key={documento.id} {...abrirLinha(destino)}>
                      <td className="celula-foto">
                        <CapaDocumento key={documento.capaUrl} documento={documento} />
                      </td>
                      <td className="celula-principal">
                        <span className="celula-titulo">
                          <Link to={destino}>{documento.titulo}</Link>
                          {documento.produtos.length > 0 && (
                            <small>Peças {documento.produtos.map((produto) => produto.codigo).join(', ')}</small>
                          )}
                        </span>
                      </td>
                      <td data-rotulo="Tipo" className="texto-suave">
                        {TIPOS[documento.tipo].singular}
                      </td>
                      <td data-rotulo="Quem pode ver" className="texto-suave">
                        {VISIBILIDADES[documento.visibilidade].rotulo}
                      </td>
                      <td data-rotulo="Publicado" className="celula-centro">
                        <Marcador marcado={documento.publicado} rotulo="Publicado" />
                      </td>
                      <td data-rotulo="Conteúdo" className="texto-suave celula-curta">
                        {resumoDoConteudo(documento)}
                      </td>
                      <td data-rotulo="Atualizado" className="texto-suave celula-curta">
                        {data(documento.atualizadoEm)}
                      </td>
                      <td className="celula-acoes">
                        {documento.publicado && <Link to={`/documentos/${documento.id}`}>Ver no portal</Link>}
                        <Link to={destino} aria-label={`Editar “${documento.titulo}”`}>
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
              nomes={['documento', 'documentos']}
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
