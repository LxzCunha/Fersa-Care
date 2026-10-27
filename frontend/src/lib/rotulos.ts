import {
  BookOpen,
  CirclePlay,
  ClipboardList,
  FileText,
  Globe,
  GraduationCap,
  LibraryBig,
  Lock,
  Megaphone,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import type {
  Idioma,
  Perfil,
  Segmento,
  StatusChamado,
  StatusUsuario,
  TipoDocumento,
  Visibilidade,
} from '../api/tipos';

/** Textos em português para os valores que a API devolve em código. */

export const TIPOS: Record<TipoDocumento, { singular: string; plural: string; icone: LucideIcon }> = {
  MANUAL: { singular: 'Manual', plural: 'Manuais de montagem', icone: BookOpen },
  VIDEO: { singular: 'Vídeo', plural: 'Vídeos', icone: CirclePlay },
  CATALOGO: { singular: 'Catálogo', plural: 'Catálogos', icone: LibraryBig },
  FICHA_TECNICA: { singular: 'Ficha técnica', plural: 'Fichas técnicas', icone: ClipboardList },
  BOLETIM: { singular: 'Boletim técnico', plural: 'Boletins técnicos', icone: Megaphone },
  TREINAMENTO: { singular: 'Treinamento', plural: 'Treinamentos', icone: GraduationCap },
  OUTRO: { singular: 'Outro material', plural: 'Outros materiais', icone: FileText },
};

/** Ordem de exibição dos tipos (mais procurados primeiro). */
export const ORDEM_DOS_TIPOS = Object.keys(TIPOS) as TipoDocumento[];

export const VISIBILIDADES: Record<
  Visibilidade,
  { rotulo: string; descricao: string; classe: string; icone: LucideIcon }
> = {
  PUBLICO: {
    rotulo: 'Público',
    descricao: 'Qualquer pessoa, mesmo sem login.',
    classe: 'selo-publico',
    icone: Globe,
  },
  AUTENTICADO: {
    rotulo: 'Clientes cadastrados',
    descricao: 'Somente quem entrou com uma conta ativa.',
    classe: 'selo-clientes',
    icone: UserCheck,
  },
  RESTRITO: {
    rotulo: 'Usuários específicos',
    descricao: 'Só as pessoas que você escolher abaixo.',
    classe: 'selo-restrito',
    icone: Lock,
  },
};

export const SEGMENTOS: Record<Segmento, string> = {
  LEVE: 'Linha leve',
  PESADA: 'Linha pesada',
  AGRICOLA: 'Agrícola',
  INDUSTRIAL: 'Industrial',
};

export const STATUS_USUARIO: Record<StatusUsuario, { rotulo: string; classe: string }> = {
  PENDENTE: { rotulo: 'Aguardando aprovação', classe: 'selo-pendente' },
  ATIVO: { rotulo: 'Ativo', classe: 'selo-ativo' },
  INATIVO: { rotulo: 'Inativo', classe: 'selo-inativo' },
};

export const STATUS_CHAMADO: Record<StatusChamado, { rotulo: string; classe: string }> = {
  ABERTO: { rotulo: 'Aberto', classe: 'selo-pendente' },
  EM_ATENDIMENTO: { rotulo: 'Em atendimento', classe: 'selo-clientes' },
  RESOLVIDO: { rotulo: 'Resolvido', classe: 'selo-ativo' },
};

export const PERFIS: Record<Perfil, string> = {
  ADMIN: 'Administrador',
  USUARIO: 'Cliente',
};

export const IDIOMAS: Record<Idioma, string> = {
  'pt-BR': 'Português',
  es: 'Espanhol',
  en: 'Inglês',
};
