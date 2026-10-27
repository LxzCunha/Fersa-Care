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
  AcaoDeAuditoria,
  Idioma,
  Perfil,
  Segmento,
  StatusChamado,
  StatusUsuario,
  TipoDocumento,
  Visibilidade,
} from '../api/tipos';

export const TIPOS: Record<TipoDocumento, { singular: string; plural: string; icone: LucideIcon }> = {
  MANUAL: { singular: 'Manual', plural: 'Manuais de montagem', icone: BookOpen },
  VIDEO: { singular: 'Vídeo', plural: 'Vídeos', icone: CirclePlay },
  CATALOGO: { singular: 'Catálogo', plural: 'Catálogos', icone: LibraryBig },
  FICHA_TECNICA: { singular: 'Ficha técnica', plural: 'Fichas técnicas', icone: ClipboardList },
  BOLETIM: { singular: 'Boletim técnico', plural: 'Boletins técnicos', icone: Megaphone },
  TREINAMENTO: { singular: 'Treinamento', plural: 'Treinamentos', icone: GraduationCap },
  OUTRO: { singular: 'Outro material', plural: 'Outros materiais', icone: FileText },
};

/** A ordem das chaves de TIPOS é a de exibição (mais procurados primeiro). */
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

/** Ações da trilha de auditoria. Âmbar (selo-pendente) só no que pede atenção: login recusado. */
export const ACOES_DE_AUDITORIA: Record<AcaoDeAuditoria, { rotulo: string; classe: string }> = {
  LOGIN: { rotulo: 'Entrou', classe: 'selo-ativo' },
  LOGIN_RECUSADO: { rotulo: 'Login recusado', classe: 'selo-pendente' },
  ACESSO_SOLICITADO: { rotulo: 'Pediu acesso', classe: 'selo-clientes' },
  SENHA_ALTERADA: { rotulo: 'Trocou a senha', classe: 'selo-clientes' },
  SESSOES_ENCERRADAS: { rotulo: 'Saiu dos outros dispositivos', classe: 'selo-clientes' },
  USUARIO_CRIADO: { rotulo: 'Cadastrou usuário', classe: 'selo-ativo' },
  USUARIO_ALTERADO: { rotulo: 'Editou usuário', classe: 'selo-clientes' },
  USUARIO_STATUS_ALTERADO: { rotulo: 'Mudou a situação', classe: 'selo-clientes' },
  USUARIO_EXCLUIDO: { rotulo: 'Excluiu usuário', classe: 'selo-inativo' },
  DOCUMENTO_CRIADO: { rotulo: 'Cadastrou documento', classe: 'selo-ativo' },
  DOCUMENTO_ALTERADO: { rotulo: 'Editou documento', classe: 'selo-clientes' },
  DOCUMENTO_EXCLUIDO: { rotulo: 'Excluiu documento', classe: 'selo-inativo' },
  PRODUTO_CRIADO: { rotulo: 'Cadastrou peça', classe: 'selo-ativo' },
  PRODUTO_ALTERADO: { rotulo: 'Editou peça', classe: 'selo-clientes' },
  PRODUTO_EXCLUIDO: { rotulo: 'Excluiu peça', classe: 'selo-inativo' },
  CATEGORIA_CRIADA: { rotulo: 'Criou categoria', classe: 'selo-ativo' },
  CATEGORIA_ALTERADA: { rotulo: 'Editou categoria', classe: 'selo-clientes' },
  CATEGORIA_EXCLUIDA: { rotulo: 'Excluiu categoria', classe: 'selo-inativo' },
  CHAMADO_ALTERADO: { rotulo: 'Atualizou chamado', classe: 'selo-clientes' },
};

