import { FolderOpen, Globe, LifeBuoy, Package, ShieldCheck, Users, type LucideIcon } from 'lucide-react';

// Toda tela nova do admin entra aqui para aparecer no menu e na trilha do topo.

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
  contador?: Contador;
}

export interface Grupo {
  id: string;
  rotulo: string;
  icone: LucideIcon;
  /** Para onde o nome do grupo leva na trilha do topo. */
  inicio: string;
  paginas: Pagina[];
}

export const PAINEL: Pagina = { rotulo: 'Painel', para: '/admin', exata: true };

export const GRUPOS: Grupo[] = [
  {
    id: 'biblioteca',
    rotulo: 'Biblioteca',
    icone: FolderOpen,
    inicio: '/admin/documentos',
    paginas: [
      { rotulo: 'Documentos', para: '/admin/documentos' },
      { rotulo: 'Cadastrar documento', para: '/admin/documentos/novo' },
    ],
  },
  {
    id: 'catalogo',
    rotulo: 'Catálogo',
    icone: Package,
    inicio: '/admin/produtos',
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
    inicio: '/admin/usuarios',
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
    inicio: '/admin/chamados',
    paginas: [
      { rotulo: 'Chamados abertos', para: '/admin/chamados?status=ABERTO', contador: 'chamados' },
      { rotulo: 'Todos os chamados', para: '/admin/chamados' },
    ],
  },
  {
    id: 'seguranca',
    rotulo: 'Segurança',
    icone: ShieldCheck,
    inicio: '/admin/auditoria',
    paginas: [
      { rotulo: 'Auditoria', para: '/admin/auditoria' },
      { rotulo: 'Acessos e senhas', para: '/admin/auditoria?grupo=ACESSOS' },
    ],
  },
  {
    id: 'portal',
    rotulo: 'Portal',
    icone: Globe,
    inicio: '/',
    paginas: [
      { rotulo: 'Página inicial', para: '/', exata: true },
      { rotulo: 'Manuais e vídeos', para: '/documentos' },
      { rotulo: 'Catálogo de peças', para: '/produtos' },
      { rotulo: 'Minha conta', para: '/minha-conta' },
    ],
  },
];

/** A página mais específica para o endereço: /admin/produtos/novo → "Cadastrar peça", não "Peças". */
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

/** Item da trilha do topo; sem `para`, é a página aberta. */
export interface Migalha {
  rotulo: string;
  para?: string;
}

/** Último item da trilha quando um registro está aberto na janela por cima da lista. */
const REGISTROS: Record<string, string> = {
  '/admin/documentos': 'Editar documento',
  '/admin/usuarios': 'Editar usuário',
  '/admin/produtos': 'Editar peça',
  '/admin/categorias': 'Editar categoria',
  '/admin/chamados': 'Chamado',
};

/** Painel › grupo › página (› registro), cada nível com link para voltar a ele. */
export function trilhaDaPagina(caminhoAtual: string, consultaAtual: string): Migalha[] {
  const atual = paginaAtual(caminhoAtual, consultaAtual);
  if (atual === PAINEL) return [{ rotulo: PAINEL.rotulo }];

  const trilha: Migalha[] = [{ rotulo: PAINEL.rotulo, para: PAINEL.para }];
  if (!atual) return trilha;

  const grupo = GRUPOS.find((candidato) => candidato.paginas.includes(atual));
  if (grupo) {
    const levaParaAqui = grupo.inicio === `${caminhoAtual}${consultaAtual}`;
    trilha.push(levaParaAqui ? { rotulo: grupo.rotulo } : { rotulo: grupo.rotulo, para: grupo.inicio });
  }

  const [caminhoDaLista = ''] = atual.para.split('?');
  const registro = caminhoAtual !== caminhoDaLista ? REGISTROS[caminhoDaLista] : undefined;
  if (registro) {
    trilha.push({ rotulo: atual.rotulo, para: `${caminhoDaLista}${consultaAtual}` }, { rotulo: registro });
  } else {
    trilha.push({ rotulo: atual.rotulo });
  }
  return trilha;
}

