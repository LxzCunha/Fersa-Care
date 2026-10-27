/**
 * Configurações do portal que a equipe pode ajustar sem mexer nas telas.
 * Os contatos vêm do arquivo .env (veja .env.example).
 */

const whatsapp = (import.meta.env.VITE_SUPORTE_WHATSAPP as string | undefined) ?? '5541999999999';
const email = (import.meta.env.VITE_SUPORTE_EMAIL as string | undefined) ?? 'suporte@fersacare.com.br';

export const SUPORTE = {
  email,
  whatsapp,
  linkWhatsapp(mensagem?: string) {
    const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : '';
    return `https://wa.me/${whatsapp.replace(/\D/g, '')}${texto}`;
  },
  linkEmail(assunto?: string) {
    return `mailto:${email}${assunto ? `?subject=${encodeURIComponent(assunto)}` : ''}`;
  },
};

/** Tamanho máximo de upload (deve ser igual ao UPLOAD_LIMITE_MB da API). */
export const LIMITE_UPLOAD_MB = Number(import.meta.env.VITE_UPLOAD_LIMITE_MB ?? 200);

/** Extensões aceitas no upload (as mesmas que a API permite). */
export const EXTENSOES_ACEITAS =
  '.pdf,.png,.jpg,.jpeg,.webp,.mp4,.webm,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip';

/** Sugestões de busca exibidas na página inicial. */
export const EXEMPLOS_DE_BUSCA = ['30205', 'folga axial', 'cubo de roda', 'catálogo'];

/** Perguntas de exemplo para quem abre o chat do assistente pela primeira vez. */
export const SUGESTOES_DO_ASSISTENTE = [
  'Como medir a folga axial do cubo de roda?',
  'Qual o torque de aperto da porca do cubo?',
  'Meu rolamento está fazendo ruído. O que pode ser?',
];
