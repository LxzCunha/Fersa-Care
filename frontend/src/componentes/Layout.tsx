import { CircleUser, FolderOpen, House, LayoutDashboard, LogIn, LogOut, Mail, MessageCircle, Package, Search } from 'lucide-react';
import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import { SUPORTE } from '../config';
import { useAutenticacao } from '../contexto/Autenticacao';
import { useNotificar } from '../contexto/Notificacoes';
import { ProvedorAssistente, useAssistente } from '../contexto/Assistente';
import { Assistente } from './Assistente';
import { CampoBusca } from './CampoBusca';
import { Marca } from './Marca';
import './Layout.css';

/** Telas sem a busca global logo abaixo do cabeçalho (têm a própria ou são formulários). */
const SEM_BUSCA_GLOBAL = ['/', '/busca', '/entrar', '/solicitar-acesso', '/minha-conta'];

/**
 * Estrutura comum a todas as telas, no modelo do site FERSA: cabeçalho branco
 * com a seção atual em pílula azul, busca em pílula logo abaixo, rodapé cinza e,
 * no celular, a barra de navegação inferior (alcance do polegar).
 */
export function Layout() {
  return (
    <ProvedorAssistente>
      <EstruturaDoPortal />
    </ProvedorAssistente>
  );
}

function EstruturaDoPortal() {
  const { usuario, ehAdmin, sair } = useAutenticacao();
  const assistente = useAssistente();
  const notificar = useNotificar();
  const navegar = useNavigate();
  const { pathname } = useLocation();

  // Ao trocar de página, volta para o topo.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  async function aoSair() {
    await sair();
    notificar('Você saiu da sua conta.');
    navegar('/');
  }

  const primeiroNome = usuario?.nome.split(' ')[0];
  /** A lista de categorias faz parte do catálogo: lá, "Catálogo" também fica marcado. */
  const classeCatalogo = ({ isActive }: { isActive: boolean }) =>
    isActive || pathname.startsWith('/categorias') ? 'active' : undefined;
  const mostrarBusca = !SEM_BUSCA_GLOBAL.some(
    (rota) => pathname === rota || (rota !== '/' && pathname.startsWith(`${rota}/`)),
  );

  return (
    <div className="estrutura">
      <a href="#conteudo" className="pular-para-conteudo">
        Pular para o conteúdo
      </a>

      <header className="cabecalho">
        <div className="conteiner cabecalho-conteudo">
          <Link to="/" className="cabecalho-marca" aria-label="FERSA Care, página inicial">
            <Marca />
          </Link>

          <nav className="nav-principal" aria-label="Principal">
            <NavLink to="/produtos" className={classeCatalogo}>
              Catálogo
            </NavLink>
            <NavLink to="/documentos">Manuais e vídeos</NavLink>
            <button type="button" onClick={() => assistente.abrir()}>
              Suporte técnico
            </button>
            {ehAdmin && <NavLink to="/admin">Administração</NavLink>}
          </nav>

          <div className="cabecalho-conta">
            {ehAdmin && (
              <Link to="/admin" className="icone-cabecalho so-celular" aria-label="Administração">
                <LayoutDashboard aria-hidden />
              </Link>
            )}
            {usuario ? (
              <>
                <Link to="/minha-conta" className="icone-cabecalho" aria-label={`Minha conta (${usuario.nome})`}>
                  <CircleUser aria-hidden />
                  <span className="conta-nome">{primeiroNome}</span>
                </Link>
                <button type="button" className="icone-cabecalho so-desktop" onClick={aoSair}>
                  <LogOut aria-hidden />
                  <span>Sair</span>
                </button>
              </>
            ) : (
              <Link to="/entrar" className="icone-cabecalho">
                <CircleUser aria-hidden />
                <span>Entrar</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {mostrarBusca && (
        <div className="barra-busca">
          <div className="conteiner">
            <BuscaGlobal />
          </div>
        </div>
      )}

      <main id="conteudo" className="conteudo">
        <Outlet />
      </main>

      <footer className="rodape">
        <div className="conteiner rodape-conteudo">
          <div className="rodape-sobre">
            <Marca tamanho="pequeno" />
            <p>
              Manuais de montagem, vídeos, catálogos e fichas técnicas das peças FERSA, com o suporte técnico do Fersa
              Care para os casos específicos.
            </p>
          </div>
          <nav className="rodape-links" aria-label="Rodapé">
            <Link to="/produtos">Catálogo de peças</Link>
            <Link to="/categorias">Categorias</Link>
            <Link to="/documentos">Manuais e vídeos</Link>
            {!usuario && <Link to="/solicitar-acesso">Solicitar acesso</Link>}
          </nav>
          <div className="rodape-contatos">
            <a href={SUPORTE.linkWhatsapp()} target="_blank" rel="noreferrer">
              <MessageCircle aria-hidden /> WhatsApp do suporte
            </a>
            <a href={SUPORTE.linkEmail()}>
              <Mail aria-hidden /> {SUPORTE.email}
            </a>
          </div>
        </div>
      </footer>

      {/* Navegação de polegar no celular (some no desktop). */}
      <nav className="nav-inferior" aria-label="Navegação rápida">
        <NavLink to="/" end>
          <House aria-hidden />
          <span>Início</span>
        </NavLink>
        <NavLink to="/produtos" className={classeCatalogo}>
          <Package aria-hidden />
          <span>Catálogo</span>
        </NavLink>
        <NavLink to="/busca">
          <Search aria-hidden />
          <span>Buscar</span>
        </NavLink>
        <NavLink to="/documentos">
          <FolderOpen aria-hidden />
          <span>Manuais</span>
        </NavLink>
        {usuario ? (
          <NavLink to="/minha-conta">
            <CircleUser aria-hidden />
            <span>Conta</span>
          </NavLink>
        ) : (
          <NavLink to="/entrar">
            <LogIn aria-hidden />
            <span>Entrar</span>
          </NavLink>
        )}
      </nav>

      {/* Assistente técnico: a bolinha de chat no canto inferior direito. */}
      <Assistente />
    </div>
  );
}

/**
 * Busca do cabeçalho. No catálogo ela filtra as peças e em "Manuais e vídeos"
 * filtra os materiais (mantendo os outros filtros); nas demais telas abre a
 * busca geral, que procura nos dois ao mesmo tempo.
 */
function BuscaGlobal() {
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const [parametros] = useSearchParams();

  function filtrarNaPagina(termo: string) {
    const novos = new URLSearchParams(parametros);
    if (termo) novos.set('busca', termo);
    else novos.delete('busca');
    novos.delete('pagina');
    const consulta = novos.toString();
    navegar(`${pathname}${consulta ? `?${consulta}` : ''}`);
  }

  if (pathname === '/produtos') {
    return (
      <CampoBusca
        valorInicial={parametros.get('busca') ?? ''}
        rotulo="Buscar no catálogo de peças"
        placeholder="Referência, nome ou aplicação..."
        aoBuscar={filtrarNaPagina}
      />
    );
  }
  if (pathname === '/documentos') {
    return (
      <CampoBusca
        valorInicial={parametros.get('busca') ?? ''}
        rotulo="Buscar manuais e vídeos"
        placeholder="Código da peça ou assunto..."
        aoBuscar={filtrarNaPagina}
      />
    );
  }
  return (
    <CampoBusca
      rotulo="Buscar peças e materiais técnicos"
      placeholder="Referência, peça ou assunto..."
      aoBuscar={(termo) => navegar(termo ? `/busca?q=${encodeURIComponent(termo)}` : '/busca')}
    />
  );
}
