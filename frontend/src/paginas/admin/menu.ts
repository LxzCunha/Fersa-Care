import { FolderOpen, Globe, LifeBuoy, Package, ShieldCheck, Users, type LucideIcon } from 'lucide-react';

/**
 * Menu da administração: as páginas, em grupos, da lateral do LayoutAdmin.
 * Uma tela nova do admin entra aqui para aparecer no menu e na trilha do topo.
 */

/** Contadores âmbar do menu: o que pede atenção do admin. */
export type Contador = 'pendentes' | 'chamados';
export const DESCRICAO_DO_CONTADOR: Record<Contador, string> = {
  pendentes: 'aguardando aprovação',
  chamados: 'chamados abertos',
};

export interface Pagina {
  rotulo: string;
  para: string;
  /** Só fica marcada no endereço exato, sem as subpáginas. */
  exata?: boolean;
  /** Mostra um contador âmbar ao lado do nome. */
  contador?: Contador;
}

export interface Grupo {
  id: string;
  rotulo: string;
  icone: LucideIcon;
  paginas: Pagina[];
}

/** O painel fica fora dos grupos, como a página inicial de um sistema de gestão. */
export const PAINEL: Pagina = { rotulo: 'Painel', para: '/admin', exata: true };

export const GRUPOS: Grupo[] = [
  {
    id: 'biblioteca',
    rotulo: 'Biblioteca',
    icone: FolderOpen,
    paginas: [
      { rotulo: 'Documentos', para: '/admin/documentos' },
      { rotulo: 'Cadastrar documento', para: '/admin/documentos/novo' },
    ],
  },
  {
    id: 'catalogo',
    rotulo: 'Catálogo',
    icone: Package,
    paginas: [
      { rotulo: 'Peças', para: '/admin/produtos' },
      { rotulo: 'Cadastrar peça', para: '/admin/produtos/novo' },
      { rotulo: 'Categorias', para: '/admin/categorias' },
      { rotulo: 'Cadastrar categoria', para: '/admin/categorias/nova' },
    ],
  },
  {
    id: 'usuarios',
    rotulo: 'Usuários',
    icone: Users,
    paginas: [
      { rotulo: 'Todos os usuários', para: '/admin/usuarios' },
      { rotulo: 'Aguardando aprovação', para: '/admin/usuarios?status=PENDENTE', contador: 'pendentes' },
      { rotulo: 'Cadastrar usuário', para: '/admin/usuarios/novo' },
    ],
  },
  {
    id: 'suporte',
    rotulo: 'Suporte',
    icone: LifeBuoy,
    paginas: [
      { rotulo: 'Chamados abertos', para: '/admin/chamados?status=ABERTO', contador: 'chamados' },
      { rotulo: 'Todos os chamados', para: '/admin/chamados' },
    ],
  },
  {
    id: 'seguranca',
    rotulo: 'Segurança',
    icone: ShieldCheck,
    paginas: [
      { rotulo: 'Auditoria', para: '/admin/auditoria' },
      { rotulo: 'Acessos e senhas', para: '/admin/auditoria?grupo=ACESSOS' },
    ],
  },
  {
    id: 'portal',
    rotulo: 'Portal',
    icone: Globe,
    paginas: [
      { rotulo: 'Página inicial', para: '/', exata: true },
      { rotulo: 'Manuais e vídeos', para: '/documentos' },
      { rotulo: 'Catálogo de peças', para: '/produtos' },
      { rotulo: 'Minha conta', para: '/minha-conta' },
    ],
  },
];

/**
 * A página do menu que corresponde ao endereço: a mais específica. Em
 * /admin/produtos/novo é "Cadastrar peça" (e não "Peças"); na edição de uma
 * peça, "Peças"; com ?status=PENDENTE, "Aguardando aprovação".
 */
export function paginaAtual(caminhoAtual: string, consultaAtual: string): Pagina | undefined {
  const parametros = new URLSearchParams(consultaAtual);
  let melhor: Pagina | undefined;
  let melhorPontuacao = -1;
  for (const pagina of [PAINEL, ...GRUPOS.flatMap((grupo) => grupo.paginas)]) {
    const [caminho = '', consulta = ''] = pagina.para.split('?');
    const filtros = [...new URLSearchParams(consulta)];
    const caminhoBate =
      caminhoAtual === caminho || (!pagina.exata && caminhoAtual.startsWith(`${caminho}/`));
    if (!caminhoBate || !filtros.every(([chave, valor]) => parametros.get(chave) === valor)) continue;

    const pontuacao = caminho.length * 10 + filtros.length;
    if (pontuacao > melhorPontuacao) {
      melhor = pagina;
      melhorPontuacao = pontuacao;
    }
  }
  return melhor;
}
