import { Check, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState, type MouseEvent as EventoDeMouse, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { DialogoConfirmacao } from '../../componentes/DialogoConfirmacao';
import { numero } from '../../lib/formatar';

/**
 * Peças das telas de cadastro, no modelo minimalista de um sistema de gestão:
 * listas com abas, busca e rodapé com a contagem; formulários numa janela
 * (modal) por cima da lista, com "Cancelar · Título · Salvar" no topo.
 */

// ─── Listas ─────────────────────────────────────────────────────────────────

/** Título da lista e o "+" para cadastrar. */
export function CabecalhoLista({ titulo, novo }: { titulo: string; novo?: { para: string; rotulo: string } }) {
  return (
    <header className="lista-cabecalho">
      <h1>{titulo}</h1>
      {novo && (
        <Link to={novo.para} className="botao-mais" aria-label={novo.rotulo} title={novo.rotulo}>
          <Plus aria-hidden />
        </Link>
      )}
    </header>
  );
}

export interface OpcaoDeAba {
  /** undefined = "Todos" (sem filtro). */
  valor?: string;
  rotulo: string;
  contagem?: number;
}

/** Abas de filtro numa barra cinza; a escolhida fica branca com contorno azul. */
export function Abas({
  rotulo,
  opcoes,
  valor,
  aoMudar,
}: {
  rotulo: string;
  opcoes: OpcaoDeAba[];
  valor: string | undefined;
  aoMudar: (valor: string | undefined) => void;
}) {
  return (
    <div className="abas" role="group" aria-label={rotulo}>
      {opcoes.map((opcao) => (
        <button
          key={opcao.rotulo}
          type="button"
          aria-pressed={valor === opcao.valor}
          onClick={() => aoMudar(opcao.valor)}
        >
          {opcao.rotulo}
          {opcao.contagem !== undefined && <span className="abas-contagem">{numero(opcao.contagem)}</span>}
        </button>
      ))}
    </div>
  );
}

/** Busca em barra cinza, com filtros extras (FiltroNaBusca) à direita. */
export function BarraBusca({
  valor,
  aoMudar,
  rotulo,
  children,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  /** Para leitores de tela e como dica, ex.: "Buscar por código, nome ou aplicação". */
  rotulo: string;
  children?: ReactNode;
}) {
  return (
    <div className="barra-busca-admin">
      <label className="barra-busca-admin-campo">
        <Search aria-hidden />
        <span className="visualmente-oculto">{rotulo}</span>
        <input type="search" placeholder="Buscar" title={rotulo} value={valor} onChange={(e) => aoMudar(e.target.value)} />
      </label>
      {children}
    </div>
  );
}

/** Filtro compacto dentro da barra de busca: "Categoria: Todas ▾". */
export function FiltroNaBusca({
  rotulo,
  valor,
  aoMudar,
  opcoes,
  rotuloTodos = 'Todos',
}: {
  rotulo: string;
  valor: string | undefined;
  aoMudar: (valor: string | undefined) => void;
  opcoes: { valor: string; rotulo: string }[];
  rotuloTodos?: string;
}) {
  return (
    <label className="filtro-na-busca">
      <span>{rotulo}</span>
      <select value={valor ?? ''} onChange={(e) => aoMudar(e.target.value || undefined)}>
        <option value="">{rotuloTodos}</option>
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Sim/não numa coluna da tabela: quadrado azul com ✓, ou vazio. */
export function Marcador({ marcado, rotulo }: { marcado: boolean; rotulo: string }) {
  return (
    <span className={`marcador ${marcado ? 'marcado' : ''}`} role="img" aria-label={`${rotulo}: ${marcado ? 'sim' : 'não'}`}>
      {marcado && <Check aria-hidden />}
    </span>
  );
}

/**
 * Clique em qualquer ponto da linha abre o cadastro (como na referência).
 * Links e botões da linha continuam funcionando normalmente; para teclado,
 * cada linha tem um link de verdade.
 */
export function useAbrirAoClicarNaLinha() {
  const navegar = useNavigate();
  return (destino: string) => ({
    className: 'linha-clicavel',
    onClick: (evento: EventoDeMouse) => {
      if ((evento.target as HTMLElement).closest('a, button, input, select, label')) return;
      navegar(destino);
    },
  });
}

/** Rodapé fixo com a contagem ("1–20 de 135 usuários") e as setas de página. */
export function RodapeLista({
  total,
  nomes,
  pagina = 1,
  porPagina,
  totalPaginas = 1,
  aoMudar,
}: {
  total: number;
  nomes: [singular: string, plural: string];
  pagina?: number;
  porPagina?: number;
  totalPaginas?: number;
  aoMudar?: (pagina: number) => void;
}) {
  const nome = total === 1 ? nomes[0] : nomes[1];
  const inicio = porPagina ? (pagina - 1) * porPagina + 1 : 1;
  const fim = porPagina ? Math.min(pagina * porPagina, total) : total;

  return (
    <div className="lista-rodape">
      {totalPaginas > 1 && aoMudar && (
        <button type="button" onClick={() => aoMudar(pagina - 1)} disabled={pagina <= 1} aria-label="Página anterior">
          <ChevronLeft aria-hidden />
        </button>
      )}
      <p aria-live="polite">
        {totalPaginas > 1 ? `${numero(inicio)}–${numero(fim)} de ${numero(total)} ${nome}` : `${numero(total)} ${nome}`}
      </p>
      {totalPaginas > 1 && aoMudar && (
        <button
          type="button"
          onClick={() => aoMudar(pagina + 1)}
          disabled={pagina >= totalPaginas}
          aria-label="Próxima página"
        >
          <ChevronRight aria-hidden />
        </button>
      )}
    </div>
  );
}

/**
 * Filtros da lista guardados na URL (dá para compartilhar e o "voltar" do
 * navegador funciona). Mudar um filtro volta para a primeira página.
 */
export function useFiltrosNaUrl(parametros: URLSearchParams, setParametros: (novos: URLSearchParams, opcoes?: { replace?: boolean }) => void) {
  return (chave: string, valor: string | undefined) => {
    const novos = new URLSearchParams(parametros);
    if (valor) novos.set(chave, valor);
    else novos.delete(chave);
    if (chave !== 'pagina') novos.delete('pagina');
    setParametros(novos, { replace: true });
  };
}

// ─── Janela de cadastro ─────────────────────────────────────────────────────

/**
 * Fecha a janela voltando para a lista com os mesmos filtros
 * (/admin/produtos/123?ativo=true → /admin/produtos?ativo=true).
 */
export function useVoltarParaLista(lista: string) {
  const navegar = useNavigate();
  const { search } = useLocation();
  return () => navegar(`${lista}${search}`);
}

/** Leva a rolagem da janela ao topo (onde fica o aviso de erro). */
export function rolarJanelaParaTopo() {
  document.querySelector('.janela-corpo')?.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Janela (modal) do cadastro, sobre a lista: "Cancelar" à esquerda, título no
 * centro e "Salvar" à direita, que envia o formulário `idFormulario`.
 * Usa o <dialog> nativo: o foco fica preso na janela e o resto da tela fica
 * inativo. Esc ou "Cancelar" com alterações não salvas pedem confirmação.
 */
export function Janela({
  titulo,
  idFormulario,
  rotuloSalvar = 'Salvar',
  salvando = false,
  alterado = false,
  progresso = null,
  largura = 'larga',
  aoFechar,
  links,
  children,
}: {
  titulo: string;
  /** Sem formulário (carregando, erro), a janela não mostra "Salvar". */
  idFormulario?: string;
  rotuloSalvar?: string;
  salvando?: boolean;
  alterado?: boolean;
  /** Percentual do envio de arquivo, ou null. */
  progresso?: number | null;
  largura?: 'estreita' | 'larga';
  aoFechar: () => void;
  /** Ações secundárias logo abaixo do topo, como "Ver no portal" e "Excluir". */
  links?: ReactNode;
  children: ReactNode;
}) {
  const referencia = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  useEffect(() => {
    const janela = referencia.current;
    if (janela && !janela.open) janela.showModal();
  }, []);

  function pedirParaFechar() {
    if (salvando) return;
    if (alterado) setConfirmandoSaida(true);
    else aoFechar();
  }

  return (
    <dialog
      ref={referencia}
      className={`janela janela-${largura}`}
      aria-labelledby={idTitulo}
      onCancel={(evento) => {
        evento.preventDefault();
        pedirParaFechar();
      }}
    >
      <header className="janela-topo">
        <button type="button" className="janela-acao" onClick={pedirParaFechar} disabled={salvando}>
          Cancelar
        </button>
        <h1 id={idTitulo}>{titulo}</h1>
        {idFormulario ? (
          <button type="submit" form={idFormulario} className="janela-acao janela-salvar" disabled={salvando}>
            {salvando ? (progresso !== null ? `Enviando ${progresso}%` : 'Salvando...') : rotuloSalvar}
          </button>
        ) : (
          <span aria-hidden />
        )}
        {progresso !== null && (
          <span className="janela-progresso" role="progressbar" aria-label="Envio do arquivo" aria-valuenow={progresso}>
            <span style={{ width: `${progresso}%` }} />
          </span>
        )}
      </header>

      <div className="janela-corpo">
        {links && <div className="janela-links">{links}</div>}
        {children}
      </div>

      <DialogoConfirmacao
        aberto={confirmandoSaida}
        titulo="Descartar as alterações?"
        mensagem="O que você mudou nesta janela ainda não foi salvo."
        textoConfirmar="Descartar"
        perigoso
        aoCancelar={() => setConfirmandoSaida(false)}
        aoConfirmar={() => {
          setConfirmandoSaida(false);
          aoFechar();
        }}
      />
    </dialog>
  );
}
