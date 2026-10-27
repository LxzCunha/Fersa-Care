import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { listarDocumentos } from '../api/portal';
import type { Segmento, TipoDocumento } from '../api/tipos';
import { BlocoSuporte } from '../componentes/BlocoSuporte';
import { GradeDocumentos } from '../componentes/CartaoDocumento';
import { AvisoErro, Carregando, EstadoVazio } from '../componentes/Estados';
import { Paginacao } from '../componentes/Paginacao';
import { useAutenticacao } from '../contexto/Autenticacao';
import { plural } from '../lib/formatar';
import { ORDEM_DOS_TIPOS, SEGMENTOS, TIPOS } from '../lib/rotulos';
import './Documentos.css';

const POR_PAGINA = 20;

export function Documentos() {
  const [parametros, setParametros] = useSearchParams();
  const { usuario } = useAutenticacao();

  const busca = parametros.get('busca') ?? '';
  const tipo = (parametros.get('tipo') as TipoDocumento | null) ?? undefined;
  const segmento = (parametros.get('segmento') as Segmento | null) ?? undefined;
  const pagina = Number(parametros.get('pagina') ?? '1') || 1;

  const filtros = { busca, tipo, segmento, pagina, porPagina: POR_PAGINA };
  const consulta = useQuery({
    queryKey: ['documentos', filtros],
    queryFn: () => listarDocumentos(filtros),
    placeholderData: keepPreviousData,
  });

  function alterar(chave: string, valor: string | undefined) {
    const novos = new URLSearchParams(parametros);
    if (valor) novos.set(chave, valor);
    else novos.delete(chave);
    if (chave !== 'pagina') novos.delete('pagina');
    setParametros(novos);
  }

  const total = consulta.data?.total ?? 0;
  const temFiltro = Boolean(busca || tipo || segmento);

  return (
    <div className="conteiner pagina">
      <title>{busca ? `“${busca}” | Manuais e vídeos | FERSA Care` : 'Manuais e vídeos | FERSA Care'}</title>

      <header className="pagina-cabecalho">
        <h1>Manuais e vídeos</h1>
        <p className="pagina-descricao">
          Manuais de montagem, vídeos, catálogos, fichas técnicas e boletins. Use a busca acima com o código da peça,
          a aplicação ou o assunto.
        </p>
      </header>

      <div className="filtros-documentos">

        <div className="filtros-linha">
          <div className="chips" role="group" aria-label="Filtrar por tipo">
            <button type="button" className="chip" aria-pressed={!tipo} onClick={() => alterar('tipo', undefined)}>
              Todos
            </button>
            {ORDEM_DOS_TIPOS.map((opcao) => (
              <button
                key={opcao}
                type="button"
                className="chip"
                aria-pressed={tipo === opcao}
                onClick={() => alterar('tipo', tipo === opcao ? undefined : opcao)}
              >
                {TIPOS[opcao].plural}
              </button>
            ))}
          </div>

          <label className="filtro-segmento">
            <span className="visualmente-oculto">Linha de produto</span>
            <select
              className="selecao"
              value={segmento ?? ''}
              onChange={(evento) => alterar('segmento', evento.target.value || undefined)}
            >
              <option value="">Todas as linhas</option>
              {(Object.keys(SEGMENTOS) as Segmento[]).map((opcao) => (
                <option key={opcao} value={opcao}>
                  {SEGMENTOS[opcao]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {!usuario && (
        <p className="aviso aviso-info aviso-visitante">
          Você está vendo os materiais públicos.{' '}
          <span>
            <Link to="/entrar?voltar=/documentos">Entre com sua conta</Link> para ver também os exclusivos para clientes.
          </span>
        </p>
      )}

      {consulta.isPending && <Carregando texto="Buscando documentos..." />}
      {consulta.isError && <AvisoErro erro={consulta.error} />}

      {consulta.data && (
        <section aria-live="polite" aria-busy={consulta.isFetching}>
          <p className="resultado-resumo">
            {busca ? (
              <>
                {plural(total, 'resultado')} para <strong>“{busca}”</strong>
              </>
            ) : (
              plural(total, 'documento')
            )}
          </p>

          {total === 0 ? (
            <EstadoVazio
              titulo={temFiltro ? 'Nenhum documento encontrado' : 'Ainda não há documentos publicados'}
              acao={
                temFiltro ? (
                  <button type="button" className="botao botao-secundario" onClick={() => setParametros({})}>
                    Limpar busca e filtros
                  </button>
                ) : undefined
              }
            >
              {temFiltro
                ? 'Confira o código da peça (sem espaços também funciona) ou tente um termo mais curto, como “cubo” ou “embreagem”.'
                : 'Assim que a equipe FERSA publicar materiais, eles aparecem aqui.'}
            </EstadoVazio>
          ) : (
            <GradeDocumentos documentos={consulta.data.itens} rotulo="Resultados" />
          )}

          <Paginacao
            pagina={consulta.data.pagina}
            totalPaginas={consulta.data.totalPaginas}
            total={consulta.data.total}
            aoMudar={(nova) => alterar('pagina', String(nova))}
          />
        </section>
      )}

      <div className="secao">
        <BlocoSuporte assunto={busca || undefined} />
      </div>
    </div>
  );
}
