import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { MessageCircle, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { listarCategorias, listarProdutos, type FiltrosProdutos } from '../api/portal';
import type { Categoria, Segmento } from '../api/tipos';
import { CartaoPeca } from '../componentes/CartaoPeca';
import { AvisoErro, Carregando, EstadoVazio } from '../componentes/Estados';
import { Paginacao } from '../componentes/Paginacao';
import { Trilha } from '../componentes/Trilha';
import { useAssistente } from '../contexto/Assistente';
import { plural } from '../lib/formatar';
import { escreverMedida, lerMedida, milimetros } from '../lib/medidas';
import { SEGMENTOS } from '../lib/rotulos';
import './Produtos.css';

const POR_PAGINA = 24;

/** Filtros de medida na URL (mm), na ordem em que aparecem no painel. */
const MEDIDAS = [
  { rotulo: 'Ø interno', minimo: 'internoMin', maximo: 'internoMax' },
  { rotulo: 'Ø externo', minimo: 'externoMin', maximo: 'externoMax' },
  { rotulo: 'Largura', minimo: 'larguraMin', maximo: 'larguraMax' },
] as const;

type ChaveDeMedida = (typeof MEDIDAS)[number]['minimo' | 'maximo'];

/**
 * Catálogo de peças no modelo do site FERSA: filtros em acordeão (lateral no
 * desktop, gaveta no celular) e cartões com as medidas principais.
 * Os filtros ficam na URL; o texto buscado vem da busca do cabeçalho.
 */
export function Produtos() {
  const [parametros, setParametros] = useSearchParams();
  const gaveta = useRef<HTMLDialogElement>(null);
  const assistente = useAssistente();

  const busca = parametros.get('busca') ?? '';
  const segmento = (parametros.get('segmento') as Segmento | null) ?? undefined;
  const categoriaId = parametros.get('categoria') ?? undefined;
  const pagina = Number(parametros.get('pagina') ?? '1') || 1;
  const medidas = Object.fromEntries(
    MEDIDAS.flatMap((m) => [m.minimo, m.maximo]).map((chave) => [chave, lerMedida(parametros.get(chave) ?? '') ?? undefined]),
  ) as Partial<Record<ChaveDeMedida, number>>;

  const filtros: FiltrosProdutos = { busca, segmento, categoriaId, ...medidas, pagina, porPagina: POR_PAGINA };
  const consulta = useQuery({
    queryKey: ['produtos', filtros],
    queryFn: () => listarProdutos(filtros),
    placeholderData: keepPreviousData,
  });
  const categorias = useQuery({ queryKey: ['categorias'], queryFn: listarCategorias });
  const categoria = categorias.data?.find((c) => c.id === categoriaId);

  function alterar(novosValores: Record<string, string | undefined>) {
    const novos = new URLSearchParams(parametros);
    for (const [chave, valor] of Object.entries(novosValores)) {
      if (valor) novos.set(chave, valor);
      else novos.delete(chave);
    }
    if (!('pagina' in novosValores)) novos.delete('pagina');
    setParametros(novos);
  }

  // Pílulas dos filtros em uso (cada uma remove o próprio filtro).
  const ativos: { rotulo: string; remover: Record<string, undefined> }[] = [];
  if (busca) ativos.push({ rotulo: `“${busca}”`, remover: { busca: undefined } });
  if (categoriaId) ativos.push({ rotulo: categoria?.nome ?? 'Categoria', remover: { categoria: undefined } });
  if (segmento) ativos.push({ rotulo: SEGMENTOS[segmento], remover: { segmento: undefined } });
  for (const m of MEDIDAS) {
    const minimo = medidas[m.minimo];
    const maximo = medidas[m.maximo];
    if (minimo === undefined && maximo === undefined) continue;
    const faixa =
      minimo !== undefined && maximo !== undefined
        ? `${escreverMedida(minimo)} a ${milimetros(maximo)}`
        : minimo !== undefined
          ? `a partir de ${milimetros(minimo)}`
          : `até ${milimetros(maximo!)}`;
    ativos.push({ rotulo: `${m.rotulo} ${faixa}`, remover: { [m.minimo]: undefined, [m.maximo]: undefined } });
  }

  const total = consulta.data?.total ?? 0;
  const titulo = categoria?.nome ?? 'Todas as peças';

  const painel = (
    <PainelFiltros
      categorias={categorias.data}
      categoriaId={categoriaId}
      segmento={segmento}
      medidas={medidas}
      alterar={alterar}
    />
  );

  return (
    <div className="conteiner pagina catalogo">
      <title>{`${titulo} | Catálogo | FERSA Care`}</title>

      <Trilha itens={categoria ? [{ rotulo: 'Catálogo', para: '/produtos' }, { rotulo: categoria.nome }] : [{ rotulo: 'Catálogo' }]} />

      <div className="catalogo-grade">
        <aside className="catalogo-lateral" aria-label="Filtros do catálogo">
          <h2 className="catalogo-lateral-titulo">Filtrar peças</h2>
          {painel}
          <div className="cartao-marca catalogo-ajuda">
            <h2>Não encontrou a peça?</h2>
            <p>O assistente técnico ajuda a identificar pela aplicação ou pelas medidas.</p>
            <button type="button" className="botao botao-principal" onClick={() => assistente.abrir()}>
              <MessageCircle aria-hidden /> Perguntar ao assistente
            </button>
          </div>
        </aside>

        <section className="catalogo-resultados" aria-labelledby="titulo-catalogo">
          <header className="catalogo-cabecalho">
            <h1 id="titulo-catalogo">{titulo}</h1>
            {categoria?.descricao && <p className="pagina-descricao">{categoria.descricao}</p>}
          </header>

          <div className="catalogo-barra">
            <p className="catalogo-contagem" aria-live="polite">
              {consulta.data ? plural(total, 'peça', 'peças') : ' '}
            </p>
            <button type="button" className="botao botao-secundario botao-filtrar" onClick={() => gaveta.current?.showModal()}>
              <SlidersHorizontal aria-hidden /> Filtrar
              {ativos.length > 0 && <span className="filtrar-contagem">{ativos.length}</span>}
            </button>
          </div>

          {ativos.length > 0 && (
            <ul className="filtros-ativos" aria-label="Filtros em uso">
              {ativos.map((ativo) => (
                <li key={ativo.rotulo}>
                  <button
                    type="button"
                    className="chip chip-removivel"
                    onClick={() => alterar(ativo.remover)}
                    aria-label={`Remover filtro: ${ativo.rotulo}`}
                  >
                    {ativo.rotulo}
                    <X aria-hidden />
                  </button>
                </li>
              ))}
              {ativos.length > 1 && (
                <li>
                  <button type="button" className="limpar-filtros" onClick={() => setParametros({})}>
                    Limpar tudo
                  </button>
                </li>
              )}
            </ul>
          )}

          {consulta.isPending && <Carregando texto="Carregando catálogo..." />}
          {consulta.isError && <AvisoErro erro={consulta.error} />}

          {consulta.data &&
            (total === 0 ? (
              <EstadoVazio
                titulo="Nenhuma peça encontrada"
                acao={
                  ativos.length > 0 ? (
                    <button type="button" className="botao botao-secundario" onClick={() => setParametros({})}>
                      Limpar busca e filtros
                    </button>
                  ) : undefined
                }
              >
                Tente a referência sem espaços ou hífens, uma faixa de medidas mais larga ou busque pela aplicação, como
                “trator” ou “cubo de roda”.
              </EstadoVazio>
            ) : (
              <>
                <ul className="grade-pecas" aria-busy={consulta.isFetching}>
                  {consulta.data.itens.map((produto) => (
                    <li key={produto.id}>
                      <CartaoPeca produto={produto} />
                    </li>
                  ))}
                </ul>
                <Paginacao
                  pagina={consulta.data.pagina}
                  totalPaginas={consulta.data.totalPaginas}
                  total={consulta.data.total}
                  aoMudar={(nova) => alterar({ pagina: String(nova) })}
                />
              </>
            ))}
        </section>
      </div>

      {/* Gaveta de filtros do celular: os resultados atualizam por trás enquanto a pessoa escolhe. */}
      <dialog ref={gaveta} className="gaveta" aria-labelledby="titulo-gaveta" onClick={(e) => e.target === gaveta.current && gaveta.current.close()}>
        <div className="gaveta-conteudo">
          <div className="gaveta-topo">
            <h2 id="titulo-gaveta">Filtrar peças</h2>
            <button type="button" className="botao botao-fantasma botao-icone" onClick={() => gaveta.current?.close()} aria-label="Fechar filtros">
              <X aria-hidden />
            </button>
          </div>
          {painel}
        </div>
        <div className="gaveta-rodape">
          <button type="button" className="botao botao-principal botao-bloco" onClick={() => gaveta.current?.close()}>
            {consulta.data ? `Ver ${plural(total, 'peça', 'peças')}` : 'Ver peças'}
          </button>
        </div>
      </dialog>
    </div>
  );
}

/** Acordeões de filtro: Categoria, Linha e Medidas (como "Dimensões" no catálogo FERSA). */
function PainelFiltros({
  categorias,
  categoriaId,
  segmento,
  medidas,
  alterar,
}: {
  categorias: Categoria[] | undefined;
  categoriaId: string | undefined;
  segmento: Segmento | undefined;
  medidas: Partial<Record<ChaveDeMedida, number>>;
  alterar: (valores: Record<string, string | undefined>) => void;
}) {
  const temMedida = Object.values(medidas).some((valor) => valor !== undefined);
  const [rascunho, setRascunho] = useState<Record<ChaveDeMedida, string>>(() => paraTexto(medidas));

  // O painel aparece duas vezes (lateral e gaveta): cada um com seus grupos de rádio.
  const prefixo = useId();

  // Se os filtros mudarem por fora (pílula removida, "Limpar tudo"), o formulário acompanha.
  const assinatura = JSON.stringify(medidas);
  useEffect(() => {
    setRascunho(paraTexto(medidas));
  }, [assinatura]);

  function aplicarMedidas(evento: FormEvent) {
    evento.preventDefault();
    alterar(
      Object.fromEntries(
        Object.entries(rascunho).map(([chave, texto]) => [chave, lerMedida(texto)?.toString()]),
      ),
    );
  }

  return (
    <div className="painel-filtros">
      <details className="filtro-grupo" open>
        <summary>Categoria</summary>
        <div className="filtro-opcoes" role="radiogroup" aria-label="Categoria">
          <OpcaoFiltro nome={`${prefixo}-categoria`} rotulo="Todas as categorias" marcado={!categoriaId} aoMarcar={() => alterar({ categoria: undefined })} />
          {categorias?.map((categoria) => (
            <OpcaoFiltro
              key={categoria.id}
              nome={`${prefixo}-categoria`}
              rotulo={categoria.nome}
              contagem={categoria.totalProdutos}
              marcado={categoriaId === categoria.id}
              aoMarcar={() => alterar({ categoria: categoria.id })}
            />
          ))}
        </div>
      </details>

      <details className="filtro-grupo" open>
        <summary>Linha</summary>
        <div className="filtro-opcoes" role="radiogroup" aria-label="Linha">
          <OpcaoFiltro nome={`${prefixo}-segmento`} rotulo="Todas as linhas" marcado={!segmento} aoMarcar={() => alterar({ segmento: undefined })} />
          {(Object.keys(SEGMENTOS) as Segmento[]).map((opcao) => (
            <OpcaoFiltro
              key={opcao}
              nome={`${prefixo}-segmento`}
              rotulo={SEGMENTOS[opcao]}
              marcado={segmento === opcao}
              aoMarcar={() => alterar({ segmento: opcao })}
            />
          ))}
        </div>
      </details>

      <details className="filtro-grupo" open={temMedida || undefined}>
        <summary>Medidas (mm)</summary>
        <form className="filtro-medidas" onSubmit={aplicarMedidas}>
          {MEDIDAS.map((m) => (
            <fieldset key={m.minimo}>
              <legend>{m.rotulo}</legend>
              <input
                className="entrada"
                inputMode="decimal"
                placeholder="Mín."
                aria-label={`${m.rotulo} mínimo`}
                value={rascunho[m.minimo]}
                onChange={(e) => setRascunho((atual) => ({ ...atual, [m.minimo]: e.target.value }))}
              />
              <input
                className="entrada"
                inputMode="decimal"
                placeholder="Máx."
                aria-label={`${m.rotulo} máximo`}
                value={rascunho[m.maximo]}
                onChange={(e) => setRascunho((atual) => ({ ...atual, [m.maximo]: e.target.value }))}
              />
            </fieldset>
          ))}
          <button type="submit" className="botao botao-contorno">
            Aplicar medidas
          </button>
        </form>
      </details>
    </div>
  );
}

function paraTexto(medidas: Partial<Record<ChaveDeMedida, number>>): Record<ChaveDeMedida, string> {
  return Object.fromEntries(
    MEDIDAS.flatMap((m) => [m.minimo, m.maximo]).map((chave) => [chave, escreverMedida(medidas[chave])]),
  ) as Record<ChaveDeMedida, string>;
}

function OpcaoFiltro({
  nome,
  rotulo,
  contagem,
  marcado,
  aoMarcar,
}: {
  nome: string;
  rotulo: string;
  contagem?: number;
  marcado: boolean;
  aoMarcar: () => void;
}) {
  return (
    <label className="opcao-filtro">
      <input type="radio" name={nome} checked={marcado} onChange={aoMarcar} />
      <span className="opcao-filtro-rotulo">{rotulo}</span>
      {contagem !== undefined && <span className="opcao-filtro-contagem">{contagem}</span>}
    </label>
  );
}
