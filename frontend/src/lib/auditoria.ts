import type { AcaoDeAuditoria, AlvoDeAuditoria, EventoDeAuditoria, Perfil, Visibilidade } from '../api/tipos';
import { PERFIS, STATUS_CHAMADO, STATUS_USUARIO, VISIBILIDADES } from './rotulos';

/**
 * Transforma os `detalhes` de um evento da trilha de auditoria em frases
 * curtas para a tabela ("Alterou: título, visibilidade", "Situação: Ativo →
 * Inativo"...). Chaves desconhecidas são ignoradas: a API pode ganhar
 * detalhes novos sem quebrar a tela.
 */

/** Nomes dos campos (como a API os chama) em português. */
const CAMPOS: Record<string, string> = {
  titulo: 'título',
  descricao: 'descrição',
  tipo: 'tipo',
  idioma: 'idioma',
  visibilidade: 'visibilidade',
  publicado: 'publicação',
  urlExterna: 'link',
  arquivo: 'arquivo',
  capa: 'capa',
  nome: 'nome',
  email: 'e-mail',
  empresa: 'empresa',
  telefone: 'telefone',
  perfil: 'perfil',
  status: 'situação',
  senha: 'senha',
  codigo: 'código',
  segmento: 'segmento',
  categoriaId: 'categoria',
  aplicacoes: 'aplicações',
  diametroInternoMm: 'Ø interno',
  diametroExternoMm: 'Ø externo',
  larguraMm: 'largura',
  pesoKg: 'peso',
  ativo: 'no catálogo',
  imagem: 'foto',
  observacao: 'anotação',
};

const MOTIVOS_DE_RECUSA: Record<string, string> = {
  CREDENCIAIS_INVALIDAS: 'e-mail ou senha errados',
  CADASTRO_PENDENTE: 'cadastro ainda em análise',
  CONTA_INATIVA: 'conta desativada',
};

const STATUS: Record<string, string> = Object.fromEntries(
  [...Object.entries(STATUS_USUARIO), ...Object.entries(STATUS_CHAMADO)].map(([codigo, { rotulo }]) => [codigo, rotulo]),
);

const ehTexto = (valor: unknown): valor is string => typeof valor === 'string';

function deParaDe(valor: unknown): { de: string; para: string } | undefined {
  if (typeof valor !== 'object' || valor === null) return undefined;
  const { de, para } = valor as Record<string, unknown>;
  return ehTexto(de) && ehTexto(para) ? { de, para } : undefined;
}

const pessoas = (quantidade: number) => (quantidade === 1 ? '1 pessoa' : `${quantidade} pessoas`);

export function descreverDetalhes({
  detalhes,
  alvo = null,
}: Pick<EventoDeAuditoria, 'detalhes'> & Partial<Pick<EventoDeAuditoria, 'alvo'>>): string[] {
  const frases: string[] = [];

  if (ehTexto(detalhes.motivo)) frases.push(`Motivo: ${MOTIVOS_DE_RECUSA[detalhes.motivo] ?? detalhes.motivo}`);
  // Com a conta identificada no registro, o e-mail digitado só repetiria a informação.
  if (ehTexto(detalhes.email) && !alvo) frases.push(`E-mail digitado: ${detalhes.email}`);

  const campos = Array.isArray(detalhes.campos) ? detalhes.campos.filter(ehTexto) : undefined;
  // Situação e perfil ganham frase própria (com de/para); aqui entram os demais campos.
  const outrosCampos = campos?.filter((campo) => !(campo in detalhes && deParaDe(detalhes[campo])));
  if (outrosCampos && outrosCampos.length > 0) {
    frases.push(`Alterou: ${outrosCampos.map((campo) => CAMPOS[campo] ?? campo).join(', ')}`);
  } else if (campos && campos.length === 0) {
    frases.push('Salvo sem mudanças');
  }

  const status = deParaDe(detalhes.status);
  if (status) frases.push(`Situação: ${STATUS[status.de] ?? status.de} → ${STATUS[status.para] ?? status.para}`);
  const perfil = deParaDe(detalhes.perfil);
  if (perfil) {
    frases.push(`Perfil: ${PERFIS[perfil.de as Perfil] ?? perfil.de} → ${PERFIS[perfil.para as Perfil] ?? perfil.para}`);
  }

  if (ehTexto(detalhes.visibilidade) && !campos) {
    frases.push(`Visibilidade: ${VISIBILIDADES[detalhes.visibilidade as Visibilidade]?.rotulo ?? detalhes.visibilidade}`);
  }
  if (Array.isArray(detalhes.acessoLiberadoPara) && detalhes.acessoLiberadoPara.length > 0) {
    frases.push(`Acesso liberado para ${pessoas(detalhes.acessoLiberadoPara.length)}`);
  }
  if (Array.isArray(detalhes.acessoRetiradoDe) && detalhes.acessoRetiradoDe.length > 0) {
    frases.push(`Acesso retirado de ${pessoas(detalhes.acessoRetiradoDe.length)}`);
  }
  return frases;
}

const TELAS_DO_ALVO: Record<AlvoDeAuditoria, string> = {
  USUARIO: '/admin/usuarios',
  DOCUMENTO: '/admin/documentos',
  PRODUTO: '/admin/produtos',
  CATEGORIA: '/admin/categorias',
  CHAMADO: '/admin/chamados',
};

const EXCLUSOES: AcaoDeAuditoria[] = ['USUARIO_EXCLUIDO', 'DOCUMENTO_EXCLUIDO', 'PRODUTO_EXCLUIDO', 'CATEGORIA_EXCLUIDA'];

/** A ação foi sobre a própria conta de quem fez (entrar, trocar a senha...). */
export function sobreAPropriaConta({ autor, alvo }: Pick<EventoDeAuditoria, 'autor' | 'alvo'>): boolean {
  return alvo?.tipo === 'USUARIO' && autor?.id === alvo.id;
}

/** Onde abrir o registro afetado no admin. Registro excluído não tem para onde ir. */
export function destinoDoAlvo({ acao, alvo }: Pick<EventoDeAuditoria, 'acao' | 'alvo'>): string | undefined {
  if (!alvo || EXCLUSOES.includes(acao)) return undefined;
  return `${TELAS_DO_ALVO[alvo.tipo]}/${alvo.id}`;
}
