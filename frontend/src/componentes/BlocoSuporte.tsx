import { Mail, MessageCircle } from 'lucide-react';
import { SUPORTE } from '../config';
import { useAssistente } from '../contexto/Assistente';
import './BlocoSuporte.css';

/**
 * Caminho para o suporte técnico: primeiro o assistente (que abre um chamado
 * com a equipe quando não resolve), e o e-mail como alternativa. O assunto
 * (ex.: "a peça 30205") já entra no começo da pergunta e no assunto do e-mail.
 */
export function BlocoSuporte({
  titulo = 'Não encontrou o que precisava?',
  assunto,
}: {
  titulo?: string;
  /** Ex.: "a peça 30205". */
  assunto?: string;
}) {
  const { abrir } = useAssistente();

  return (
    <aside className="bloco-suporte" aria-labelledby="titulo-suporte">
      <div className="bloco-suporte-texto">
        <h2 id="titulo-suporte">{titulo}</h2>
        <p>
          O assistente técnico responde com base nos manuais, fichas e boletins da FERSA. Se não resolver, ele abre um
          chamado com a nossa equipe técnica.
        </p>
      </div>
      <div className="grupo-botoes">
        <button
          type="button"
          className="botao botao-principal"
          onClick={() => abrir({ rascunho: assunto ? `Sobre ${assunto}: ` : undefined })}
        >
          <MessageCircle aria-hidden />
          Perguntar ao assistente
        </button>
        <a className="botao botao-secundario" href={SUPORTE.linkEmail(assunto ? `Suporte: ${assunto}` : 'Suporte técnico')}>
          <Mail aria-hidden />
          Enviar e-mail
        </a>
      </div>
    </aside>
  );
}
