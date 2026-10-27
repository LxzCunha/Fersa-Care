import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleUser,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  UserCog,
  X,
} from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { listarChamados, listarUsuarios } from '../../api/admin';
import { Marca } from '../../componentes/Marca';
import { useAutenticacao, useSairDaConta } from '../../contexto/Autenticacao';
import { DESCRICAO_DO_CONTADOR, GRUPOS, PAINEL, paginaAtual, type Contador } from './menu';

const CHAVE_PENDENTES = ['admin', 'pendentes'] as const;
const CHAVE_CHAMADOS_ABERTOS = ['admin', 'chamados-abertos'] as const;

/** "Catálogo" → "catalogo": a busca do menu ignora acentos e maiúsculas. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

const ehDesktop = () => window.matchMedia('(min-width: 64rem)').matches;

/** Preferência de cada pessoa (menu recolhido no desktop); some sem problema se o navegador bloquear. */
const CHAVE_MENU_RECOLHIDO = 'fersa-care:admin-menu-recolhido';

function lerMenuRecolhido(): boolean {
  try {
    return localStorage.getItem(CHAVE_MENU_RECOLHIDO) === '1';
  } catch {
    return false;
  }
}

function salvarMenuRecolhido(recolhido: boolean) {
  try {
    localStorage.setItem(CHAVE_MENU_RECOLHIDO, recolhido ? '1' : '0');
  } catch {
    // Sem armazenamento local: o menu só não lembra a escolha.
  }
}

/**
 * Estrutura da administração, no modelo de um sistema de gestão: menu lateral
 * escuro com grupos que abrem e fecham, busca de página e "Sair" no rodapé;
 * barra branca no topo com a conta. No desktop o menu pode ser recolhido até
 * ficar só com os ícones; no celular ele vira uma gaveta.
 */
export function LayoutAdmin() {
  const { usuario } = useAutenticacao();
  const navegar = useNavigate();
  const { pathname, search } = useLocation();
  const idMenu = useId();

  const pendentes = useQuery({
    queryKey: CHAVE_PENDENTES,
    queryFn: () => listarUsuarios({ status: 'PENDENTE', porPagina: 1 }),
  });
  const chamadosAbertos = useQuery({
    queryKey: CHAVE_CHAMADOS_ABERTOS,
    queryFn: () => listarChamados({ status: 'ABERTO', porPagina: 1 }),
  });
  const contadores: Record<Contador, number> = {
    pendentes: pendentes.data?.total ?? 0,
    chamados: chamadosAbertos.data?.total ?? 0,
  };

  const atual = paginaAtual(pathname, search);
  const grupoAtual = GRUPOS.find((grupo) => atual && grupo.paginas.includes(atual));

  const [recolhido, setRecolhido] = useState(lerMenuRecolhido);
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [gruposAbertos, setGruposAbertos] = useState(() => new Set(grupoAtual ? [grupoAtual.id] : []));
  const [busca, setBusca] = useState('');
  const abrirGavetaRef = useRef<HTMLButtonElement>(null);
  const fecharGavetaRef = useRef<HTMLButtonElement>(null);

  // Ao trocar de página: volta ao topo e fecha a gaveta do celular. A gaveta
  // (estado do React) é ajustada na própria renderização, e não no efeito.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);
  const endereco = pathname + search;
  const [enderecoAnterior, setEnderecoAnterior] = useState(endereco);
  if (endereco !== enderecoAnterior) {
    setEnderecoAnterior(endereco);
    setGavetaAberta(false);
  }

  // O grupo da página atual sempre aparece aberto.
  const [grupoAnterior, setGrupoAnterior] = useState(grupoAtual);
  if (grupoAtual !== grupoAnterior) {
    setGrupoAnterior(grupoAtual);
    if (grupoAtual) {
      const { id } = grupoAtual;
      setGruposAbertos((abertos) => (abertos.has(id) ? abertos : new Set(abertos).add(id)));
    }
  }

  // Gaveta aberta: foco no botão de fechar e Esc fecha.
  useEffect(() => {
    if (!gavetaAberta) return;
    fecharGavetaRef.current?.focus();
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') fecharGaveta();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [gavetaAberta]);

  function fecharGaveta() {
    setGavetaAberta(false);
    // Espera o conteúdo deixar de ser "inert" para devolver o foco ao botão que abriu.
    requestAnimationFrame(() => abrirGavetaRef.current?.focus());
  }

  function alternarRecolhido() {
    setRecolhido(!recolhido);
    salvarMenuRecolhido(!recolhido);
  }

  function alternarGrupo(id: string) {
    // Com o menu recolhido, clicar no ícone do grupo abre o menu já com o grupo aberto.
    if (recolhido && ehDesktop()) {
      setRecolhido(false);
      salvarMenuRecolhido(false);
      setGruposAbertos((abertos) => new Set(abertos).add(id));
      return;
    }
    setGruposAbertos((abertos) => {
      const novos = new Set(abertos);
      if (novos.has(id)) novos.delete(id);
      else novos.add(id);
      return novos;
    });
  }

  const termo = normalizar(busca);
  const mostrarPainel = !termo || normalizar(PAINEL.rotulo).includes(termo);
  const gruposVisiveis = termo
    ? GRUPOS.map((grupo) =>
        normalizar(grupo.rotulo).includes(termo)
          ? grupo
          : { ...grupo, paginas: grupo.paginas.filter((pagina) => normalizar(pagina.rotulo).includes(termo)) },
      ).filter((grupo) => grupo.paginas.length > 0)
    : GRUPOS;
  const primeiroResultado = mostrarPainel ? PAINEL : gruposVisiveis[0]?.paginas[0];

  /** Enter na busca abre a primeira página encontrada. */
  function irParaPrimeiroResultado(evento: FormEvent) {
    evento.preventDefault();
    if (!termo || !primeiroResultado) return;
    setBusca('');
    navegar(primeiroResultado.para);
  }

  const aoSair = useSairDaConta();

  const alerta = (contador: Contador | undefined) =>
    contador && contadores[contador] > 0 ? (
      <span className="lateral-alerta">
        {contadores[contador]}
        <span className="visualmente-oculto"> {DESCRICAO_DO_CONTADOR[contador]}</span>
      </span>
    ) : null;

  return (
    <div className={`admin ${recolhido ? 'admin-recolhido' : ''}`}>
      <a href="#conteudo-admin" className="pular-para-conteudo">
        Pular para o conteúdo
      </a>

      <aside id={idMenu} className={`lateral ${gavetaAberta ? 'aberta' : ''}`} aria-label="Menu da administração">
        <div className="lateral-topo">
          <button
            type="button"
            className="lateral-botao lateral-recolher"
            onClick={alternarRecolhido}
            aria-expanded={!recolhido}
            aria-controls={idMenu}
            aria-label={recolhido ? 'Expandir o menu' : 'Recolher o menu'}
            title={recolhido ? 'Expandir o menu' : 'Recolher o menu'}
          >
            <Menu aria-hidden />
          </button>
          <button
            ref={fecharGavetaRef}
            type="button"
            className="lateral-botao lateral-fechar"
            onClick={fecharGaveta}
            aria-label="Fechar o menu"
          >
            <X aria-hidden />
          </button>
          <span className="lateral-titulo">Administração</span>
        </div>

        <div className="lateral-ferramentas">
          <button type="button" onClick={() => setGruposAbertos(new Set(GRUPOS.map((grupo) => grupo.id)))}>
            <ChevronsUpDown aria-hidden /> Expandir
          </button>
          <button type="button" onClick={() => setGruposAbertos(new Set())}>
            <ChevronsDownUp aria-hidden /> Recolher
          </button>
        </div>

        <form role="search" className="lateral-busca" onSubmit={irParaPrimeiroResultado}>
          <Search aria-hidden />
          <input
            type="search"
            placeholder="Buscar página..."
            aria-label="Buscar página do menu"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
          />
        </form>

        <nav className="lateral-menu" aria-label="Administração">
          <ul>
            {mostrarPainel && (
              <li>
                <Link
                  to={PAINEL.para}
                  className={`lateral-item ${atual === PAINEL ? 'ativo' : ''}`}
                  aria-current={atual === PAINEL ? 'page' : undefined}
                  title={recolhido ? PAINEL.rotulo : undefined}
                >
                  <LayoutDashboard className="lateral-icone" aria-hidden />
                  <span className="lateral-rotulo">{PAINEL.rotulo}</span>
                </Link>
              </li>
            )}

            {gruposVisiveis.map((grupo) => {
              const aberto = Boolean(termo) || gruposAbertos.has(grupo.id);
              const contadorDoGrupo = grupo.paginas.find((pagina) => pagina.contador && contadores[pagina.contador] > 0)?.contador;
              const Icone = grupo.icone;
              return (
                <li key={grupo.id} className={`lateral-grupo ${grupo === grupoAtual ? 'contem-atual' : ''}`}>
                  <button
                    type="button"
                    className="lateral-item"
                    aria-expanded={aberto}
                    aria-controls={`${idMenu}-${grupo.id}`}
                    onClick={() => alternarGrupo(grupo.id)}
                    title={recolhido ? grupo.rotulo : undefined}
                  >
                    <Icone className="lateral-icone" aria-hidden />
                    <span className="lateral-rotulo">{grupo.rotulo}</span>
                    {!aberto && alerta(contadorDoGrupo)}
                    <ChevronDown className="lateral-seta" aria-hidden />
                  </button>
                  <ul id={`${idMenu}-${grupo.id}`} className="lateral-subitens" hidden={!aberto}>
                    {grupo.paginas.map((pagina) => (
                      <li key={pagina.para}>
                        <Link
                          to={pagina.para}
                          className={`lateral-subitem ${pagina === atual ? 'ativo' : ''}`}
                          aria-current={pagina === atual ? 'page' : undefined}
                        >
                          {pagina.rotulo}
                          {alerta(pagina.contador)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
          {!primeiroResultado && <p className="lateral-vazio">Nenhuma página com “{busca.trim()}”.</p>}
        </nav>

        <button type="button" className="lateral-sair" onClick={aoSair} title={recolhido ? 'Sair' : undefined}>
          <LogOut aria-hidden />
          <span className="lateral-rotulo">Sair</span>
        </button>
      </aside>

      {gavetaAberta && <div className="lateral-sombra" onClick={fecharGaveta} aria-hidden />}

      <div className="admin-principal" inert={gavetaAberta}>
        <header className="admin-topo">
          <button
            ref={abrirGavetaRef}
            type="button"
            className="admin-topo-menu"
            onClick={() => setGavetaAberta(true)}
            aria-expanded={gavetaAberta}
            aria-controls={idMenu}
            aria-label="Abrir o menu"
          >
            <Menu aria-hidden />
          </button>
          <Link to="/admin" className="admin-topo-marca" aria-label="FERSA Care, painel da administração">
            <Marca tamanho="pequeno" />
          </Link>
          {atual && (
            <p className="admin-topo-trilha so-desktop">
              {grupoAtual && (
                <>
                  {grupoAtual.rotulo}
                  <ChevronRight aria-hidden />
                </>
              )}
              <strong>{atual.rotulo}</strong>
            </p>
          )}
          <div className="admin-topo-acoes">
            <Link to="/" className="admin-topo-link so-desktop">
              <Globe aria-hidden /> Ver o portal
            </Link>
            <MenuDaConta nome={usuario?.nome.split(' ')[0] ?? 'Conta'} aoSair={aoSair} />
          </div>
        </header>

        <main id="conteudo-admin" className="admin-conteudo">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Nome de quem está logado, com a conta, o portal e "Sair" num menu que abre ao clicar. */
function MenuDaConta({ nome, aoSair }: { nome: string; aoSair: () => void }) {
  const [aberto, setAberto] = useState(false);
  const caixaRef = useRef<HTMLDivElement>(null);
  const idLista = useId();
  const { pathname } = useLocation();

  // Fecha ao trocar de página (ajuste feito na renderização, e não num efeito).
  const [caminhoAnterior, setCaminhoAnterior] = useState(pathname);
  if (pathname !== caminhoAnterior) {
    setCaminhoAnterior(pathname);
    setAberto(false);
  }

  // Fecha ao clicar fora ou com Esc.
  useEffect(() => {
    if (!aberto) return;
    const aoClicarFora = (evento: PointerEvent) => {
      if (!caixaRef.current?.contains(evento.target as Node)) setAberto(false);
    };
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAberto(false);
    };
    document.addEventListener('pointerdown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('pointerdown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  return (
    <div className="menu-conta" ref={caixaRef}>
      <button
        type="button"
        className="menu-conta-botao"
        aria-expanded={aberto}
        aria-controls={idLista}
        onClick={() => setAberto(!aberto)}
      >
        <CircleUser aria-hidden />
        <span>{nome}</span>
        <ChevronDown className="menu-conta-seta" aria-hidden />
      </button>
      <div id={idLista} className="menu-conta-lista" hidden={!aberto}>
        <Link to="/minha-conta">
          <UserCog aria-hidden /> Minha conta
        </Link>
        <Link to="/">
          <Globe aria-hidden /> Ver o portal
        </Link>
        <button type="button" onClick={aoSair}>
          <LogOut aria-hidden /> Sair
        </button>
      </div>
    </div>
  );
}
