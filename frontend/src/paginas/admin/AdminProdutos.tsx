import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { PackagePlus, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { listarCategoriasAdmin, listarProdutosAdmin } from '../../api/admin';
import type { Segmento } from '../../api/tipos';
import { ImagemPeca } from '../../componentes/CartaoPeca';
import { AvisoErro, Carregando, EstadoVazio } from '../../componentes/Estados';
import { Paginacao } from '../../componentes/Paginacao';
import { plural } from '../../lib/formatar';
import { useValorAtrasado } from '../../lib/ganchos';
import { SEGMENTOS } from '../../lib/rotulos';

export function AdminProdutos() {
  const [parametros, setParametros] = useSearchParams();
  const [busca, setBusca] = useState('');
  const termo = useValorAtrasado(busca.trim());

  const segmento = (parametros.get('segmento') as Segmento | null) ?? undefined;
  const situacao = parametros.get('ativo');
  const categoriaId = parametros.get('categoria') ?? undefined;
  const pagina = Number(parametros.get('pagina') ?? '1') || 1;

  function alterar(chave: string, valor: string | undefined) {
    const novos = new URLSearchParams(parametros);
    if (valor) novos.set(chave, valor);
    else novos.delete(chave);
    if (chave !== 'pagina') novos.delete('pagina');
    setParametros(novos, { replace: true });
  }

  const filtros = {
    busca: termo || undefined,
    segmento,
    categoriaId,
    ativo: situacao === null ? undefined : situacao === 'true',
    pagina,
    porPagina: 25,
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

      <header className="admin-cabecalho">
        <div>
          <h1>Peças</h1>
          <p>Catálogo de peças. Os documentos podem ser ligados a uma ou mais peças.</p>
        </div>
        <Link to="/admin/produtos/novo" className="botao botao-principal">
          <PackagePlus aria-hidden /> Cadastrar peça
        </Link>
      </header>

      <div className="admin-filtros">
        <label className="campo">
          <span className="campo-rotulo">Buscar</span>
          <input
            className="entrada"
            type="search"
            placeholder="Código, nome ou aplicação"
            value={busca}
            onChange={(evento) => {
              setBusca(evento.target.value);
              if (pagina !== 1) alterar('pagina', undefined);
            }}
          />
        </label>
        <label className="campo">
          <span className="campo-rotulo">Categoria</span>
          <select className="selecao" value={categoriaId ?? ''} onChange={(e) => alterar('categoria', e.target.value || undefined)}>
            <option value="">Todas</option>
            {categorias.data?.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span className="campo-rotulo">Linha</span>
          <select className="selecao" value={segmento ?? ''} onChange={(e) => alterar('segmento', e.target.value || undefined)}>
            <option value="">Todas</option>
            {(Object.keys(SEGMENTOS) as Segmento[]).map((opcao) => (
              <option key={opcao} value={opcao}>
                {SEGMENTOS[opcao]}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span className="campo-rotulo">Situação</span>
          <select className="selecao" value={situacao ?? ''} onChange={(e) => alterar('ativo', e.target.value || undefined)}>
            <option value="">Todas</option>
            <option value="true">No catálogo</option>
            <option value="false">Fora do catálogo</option>
          </select>
        </label>
      </div>

      {consulta.isPending && <Carregando />}
      {consulta.isError && <AvisoErro erro={consulta.error} />}

      {consulta.data &&
        (consulta.data.total === 0 ? (
          <EstadoVazio
            titulo="Nenhuma peça encontrada"
            acao={
              <Link to="/admin/produtos/novo" className="botao botao-principal">
                <PackagePlus aria-hidden /> Cadastrar peça
              </Link>
            }
          >
            Cadastre as peças para ligar documentos a elas e permitir a busca pelo código.
          </EstadoVazio>
        ) : (
          <>
            <p className="resultado-resumo">{plural(consulta.data.total, 'peça', 'peças')}</p>
            <div className="tabela-moldura">
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
                    <th scope="col">Situação</th>
                    <th scope="col">
                      <span className="visualmente-oculto">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {consulta.data.itens.map((produto) => (
                    <tr key={produto.id}>
                      <td className="celula-foto">
                        <ImagemPeca produto={produto} />
                      </td>
                      <td className="celula-principal">
                        <Link to={`/admin/produtos/${produto.id}`} className="codigo">
                          {produto.codigo}
                        </Link>
                      </td>
                      <td data-rotulo="Nome">{produto.nome}</td>
                      <td data-rotulo="Categoria" className="texto-suave">
                        {produto.categoria?.nome ?? 'Sem categoria'}
                      </td>
                      <td data-rotulo="Linha" className="texto-suave">
                        {SEGMENTOS[produto.segmento]}
                      </td>

                      <td data-rotulo="Situação">
                        <span className={`selo ${produto.ativo ? 'selo-ativo' : 'selo-inativo'}`}>
                          {produto.ativo ? 'No catálogo' : 'Fora do catálogo'}
                        </span>
                      </td>
                      <td className="celula-acoes">
                        <Link
                          to={`/admin/produtos/${produto.id}`}
                          className="botao botao-fantasma botao-pequeno"
                          aria-label={`Editar ${produto.codigo}`}
                        >
                          <Pencil aria-hidden /> Editar
                        </Link>
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
