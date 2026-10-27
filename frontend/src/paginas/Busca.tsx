import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { listarCategorias, listarDocumentos, listarProdutos } from '../api/portal';
import { BlocoSuporte } from '../componentes/BlocoSuporte';
import { CampoBusca } from '../componentes/CampoBusca';
import { CartaoPeca } from '../componentes/CartaoPeca';
import { AvisoErro, Carregando, EstadoVazio } from '../componentes/Estados';
import { ListaDocumentos } from '../componentes/ListaDocumentos';
import { EXEMPLOS_DE_BUSCA } from '../config';
import { numero, plural } from '../lib/formatar';
import { ListaCategorias } from './Categorias';
import './Busca.css';

const PECAS_NA_BUSCA = 6;
const MATERIAIS_NA_BUSCA = 8;

/**
 * Busca geral: procura ao mesmo tempo nas peças do catálogo e nos manuais e
 * vídeos, para quem só tem o código da caixa ou o nome do problema.
 */
export function Busca() {
  const [parametros] = useSearchParams();
  const navegar = useNavigate();
  const termo = (parametros.get('q') ?? '').trim();

  const pecas = useQuery({
    queryKey: ['busca', 'pecas', termo],
    queryFn: () => listarProdutos({ busca: termo, porPagina: PECAS_NA_BUSCA }),
    enabled: termo !== '',
  });
  const materiais = useQuery({
    queryKey: ['busca', 'materiais', termo],
    queryFn: () => listarDocumentos({ busca: termo, porPagina: MATERIAIS_NA_BUSCA }),
    enabled: termo !== '',
  });
  const categorias = useQuery({ queryKey: ['categorias'], queryFn: listarCategorias, enabled: termo === '' });

  function buscar(novo: string) {
    navegar(novo ? `/busca?q=${encodeURIComponent(novo)}` : '/busca', { replace: Boolean(termo) });
  }

  const carregando = pecas.isPending || materiais.isPending;
  const nada = !carregando && pecas.data?.total === 0 && materiais.data?.total === 0;

  return (
    <div className="conteiner pagina">
      <title>{termo ? `“${termo}” | Busca | FERSA Care` : 'Buscar | FERSA Care'}</title>

      <header className="busca-cabecalho">
        <h1>{termo ? <>Resultados para “{termo}”</> : 'O que você procura?'}</h1>
        <CampoBusca
          variante="destaque"
          valorInicial={termo}
          aoBuscar={buscar}
          rotulo="Buscar peças e materiais técnicos"
          placeholder="Referência, peça ou assunto..."
          focarAoAbrir={!termo}
        />
      </header>

      {!termo && (
        <>
          <div className="busca-sugestoes">
            <span>Experimente:</span>
            {EXEMPLOS_DE_BUSCA.map((exemplo) => (
              <button key={exemplo} type="button" className="chip" onClick={() => buscar(exemplo)}>
                {exemplo}
              </button>
            ))}
          </div>
          {categorias.data && categorias.data.length > 0 && (
            <section className="secao" aria-labelledby="titulo-categorias">
              <h2 id="titulo-categorias" className="secao-titulo">
                Ou navegue pelas categorias
              </h2>
              <ListaCategorias categorias={categorias.data} />
            </section>
          )}
        </>
      )}

      {termo && carregando && <Carregando texto="Buscando..." />}
      {(pecas.isError || materiais.isError) && <AvisoErro erro={pecas.error ?? materiais.error} />}

      {nada && (
        <EstadoVazio titulo="Nada encontrado">
          Confira a referência (sem espaços ou hífens também funciona) ou tente um termo mais curto, como “cubo” ou
          “embreagem”. Se preferir, fale com o suporte abaixo.
        </EstadoVazio>
      )}

      {pecas.data && pecas.data.total > 0 && (
        <section className="secao busca-grupo" aria-labelledby="titulo-pecas">
          <div className="busca-grupo-cabecalho">
            <h2 id="titulo-pecas" className="secao-titulo">
              Peças <span className="busca-total">{numero(pecas.data.total)}</span>
            </h2>
            {pecas.data.total > PECAS_NA_BUSCA && (
              <Link to={`/produtos?busca=${encodeURIComponent(termo)}`} className="link-seta">
                Ver todas no catálogo <ArrowRight aria-hidden />
              </Link>
            )}
          </div>
          <ul className="grade-pecas">
            {pecas.data.itens.map((produto) => (
              <li key={produto.id}>
                <CartaoPeca produto={produto} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {materiais.data && materiais.data.total > 0 && (
        <section className="secao busca-grupo" aria-labelledby="titulo-materiais">
          <div className="busca-grupo-cabecalho">
            <h2 id="titulo-materiais" className="secao-titulo">
              Manuais e materiais <span className="busca-total">{numero(materiais.data.total)}</span>
            </h2>
            {materiais.data.total > MATERIAIS_NA_BUSCA && (
              <Link to={`/documentos?busca=${encodeURIComponent(termo)}`} className="link-seta">
                Ver {plural(materiais.data.total, 'material', 'materiais')} <ArrowRight aria-hidden />
              </Link>
            )}
          </div>
          <ListaDocumentos documentos={materiais.data.itens} rotulo={`Materiais encontrados para ${termo}`} />
        </section>
      )}

      {termo && !carregando && (
        <div className="secao">
          <BlocoSuporte assunto={termo} />
        </div>
      )}
    </div>
  );
}
