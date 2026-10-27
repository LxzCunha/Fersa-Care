import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Eye, FilePlus, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { listarDocumentosAdmin } from '../../api/admin';
import type { TipoDocumento, Visibilidade } from '../../api/tipos';
import { AvisoErro, Carregando, EstadoVazio } from '../../componentes/Estados';
import { resumoDoConteudo } from '../../componentes/ListaDocumentos';
import { Paginacao } from '../../componentes/Paginacao';
import { SeloVisibilidade } from '../../componentes/SeloVisibilidade';
import { data, plural } from '../../lib/formatar';
import { useValorAtrasado } from '../../lib/ganchos';
import { ORDEM_DOS_TIPOS, TIPOS, VISIBILIDADES } from '../../lib/rotulos';

export function AdminDocumentos() {
  const [parametros, setParametros] = useSearchParams();
  // A busca consulta a API sozinha, depois de uma pequena pausa na digitação.
  const [busca, setBusca] = useState('');
  const buscaAtrasada = useValorAtrasado(busca.trim());

  const tipo = (parametros.get('tipo') as TipoDocumento | null) ?? undefined;
  const visibilidade = (parametros.get('visibilidade') as Visibilidade | null) ?? undefined;
  const situacao = parametros.get('publicado');
  const pagina = Number(parametros.get('pagina') ?? '1') || 1;

  function alterar(chave: string, valor: string | undefined) {
    const novos = new URLSearchParams(parametros);
    if (valor) novos.set(chave, valor);
    else novos.delete(chave);
    if (chave !== 'pagina') novos.delete('pagina');
    setParametros(novos, { replace: true });
  }

  const filtros = {
    busca: buscaAtrasada || undefined,
    tipo,
    visibilidade,
    publicado: situacao === null ? undefined : situacao === 'true',
    pagina,
    porPagina: 20,
  };
  const consulta = useQuery({
    queryKey: ['admin', 'documentos', filtros],
    queryFn: () => listarDocumentosAdmin(filtros),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <title>Documentos | Administração FERSA Care</title>

      <header className="admin-cabecalho">
        <div>
          <h1>Documentos</h1>
          <p>Cadastre manuais, vídeos e catálogos e escolha quem pode ver cada um.</p>
        </div>
        <Link to="/admin/documentos/novo" className="botao botao-principal">
          <FilePlus aria-hidden /> Cadastrar documento
        </Link>
      </header>

      <div className="admin-filtros">
        <label className="campo">
          <span className="campo-rotulo">Buscar</span>
          <input
            className="entrada"
            type="search"
            placeholder="Título, descrição ou código da peça"
            value={busca}
            onChange={(evento) => {
              setBusca(evento.target.value);
              if (pagina !== 1) alterar('pagina', undefined);
            }}
          />
        </label>
        <label className="campo">
          <span className="campo-rotulo">Tipo</span>
          <select className="selecao" value={tipo ?? ''} onChange={(e) => alterar('tipo', e.target.value || undefined)}>
            <option value="">Todos</option>
            {ORDEM_DOS_TIPOS.map((opcao) => (
              <option key={opcao} value={opcao}>
                {TIPOS[opcao].singular}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span className="campo-rotulo">Quem pode ver</span>
          <select
            className="selecao"
            value={visibilidade ?? ''}
            onChange={(e) => alterar('visibilidade', e.target.value || undefined)}
          >
            <option value="">Todos os níveis</option>
            {(Object.keys(VISIBILIDADES) as Visibilidade[]).map((opcao) => (
              <option key={opcao} value={opcao}>
                {VISIBILIDADES[opcao].rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span className="campo-rotulo">Situação</span>
          <select className="selecao" value={situacao ?? ''} onChange={(e) => alterar('publicado', e.target.value || undefined)}>
            <option value="">Todas</option>
            <option value="true">Publicados</option>
            <option value="false">Rascunhos</option>
          </select>
        </label>
      </div>

      {consulta.isPending && <Carregando />}
      {consulta.isError && <AvisoErro erro={consulta.error} />}

      {consulta.data &&
        (consulta.data.total === 0 ? (
          <EstadoVazio
            titulo={filtros.busca || tipo || visibilidade || situacao ? 'Nenhum documento com esses filtros' : 'Nenhum documento cadastrado'}
            acao={
              <Link to="/admin/documentos/novo" className="botao botao-principal">
                <FilePlus aria-hidden /> Cadastrar documento
              </Link>
            }
          >
            Os documentos cadastrados aqui aparecem no portal conforme o nível de acesso escolhido.
          </EstadoVazio>
        ) : (
          <>
            <p className="resultado-resumo">{plural(consulta.data.total, 'documento')}</p>
            <div className="tabela-moldura">
              <table className="tabela">
                <thead>
                  <tr>
                    <th scope="col">Documento</th>
                    <th scope="col">Quem pode ver</th>
                    <th scope="col">Conteúdo</th>
                    <th scope="col">Atualizado</th>
                    <th scope="col">
                      <span className="visualmente-oculto">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {consulta.data.itens.map((documento) => (
                    <tr key={documento.id}>
                      <td className="celula-principal">
                        <span className="celula-titulo">
                          <Link to={`/admin/documentos/${documento.id}`}>{documento.titulo}</Link>
                          <small>
                            {TIPOS[documento.tipo].singular}
                            {documento.produtos.length > 0 &&
                              `, peças ${documento.produtos.map((produto) => produto.codigo).join(', ')}`}
                          </small>
                        </span>
                      </td>
                      <td data-rotulo="Quem pode ver">
                        <span className="celula-selos">
                          <SeloVisibilidade documento={documento} visao="admin" />
                        </span>
                      </td>
                      <td data-rotulo="Conteúdo" className="texto-suave">
                        {resumoDoConteudo(documento)}
                      </td>
                      <td data-rotulo="Atualizado" className="texto-suave">
                        {data(documento.atualizadoEm)}
                      </td>
                      <td className="celula-acoes">
                        <span className="acoes-linha">
                          <Link
                            to={`/documentos/${documento.id}`}
                            className="botao botao-fantasma botao-pequeno"
                            aria-label={`Ver “${documento.titulo}” no portal`}
                          >
                            <Eye aria-hidden /> Ver
                          </Link>
                          <Link
                            to={`/admin/documentos/${documento.id}`}
                            className="botao botao-secundario botao-pequeno"
                            aria-label={`Editar “${documento.titulo}”`}
                          >
                            <Pencil aria-hidden /> Editar
                          </Link>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao
              pagina={consulta.data.pagina}
              totalPaginas={consulta.data.totalPaginas}
              total={consulta.data.total}
              aoMudar={(nova) => alterar('pagina', String(nova))}
            />
          </>
        ))}
    </>
  );
}
