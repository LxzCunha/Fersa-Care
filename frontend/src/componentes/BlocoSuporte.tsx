import { Mail, MessageCircle } from 'lucide-react';
import { SUPORTE } from '../config';
import './BlocoSuporte.css';

/**
 * Caminho para o atendimento humano: os casos que os materiais não resolvem
 * vão para o técnico. O texto pode citar a peça para o técnico já saber o assunto.
 */
export function BlocoSuporte({
  titulo = 'Não encontrou o que precisava?',
  assunto,
}: {
  titulo?: string;
  /** Ex.: "rolamento 30205" — entra na mensagem do WhatsApp e no assunto do e-mail. */
  assunto?: string;
}) {
  const mensagem = assunto
    ? `Olá! Preciso de ajuda técnica sobre ${assunto}.`
    : 'Olá! Preciso de ajuda técnica com uma peça FERSA.';

  return (
    <aside className="bloco-suporte" aria-labelledby="titulo-suporte">
      <div className="bloco-suporte-texto">
        <h2 id="titulo-suporte">{titulo}</h2>
        <p>
          Nossa equipe técnica responde casos específicos de montagem, aplicação e compatibilidade. Informe o
          código da peça e o veículo ou máquina.
        </p>
      </div>
      <div className="grupo-botoes">
        <a className="botao botao-principal" href={SUPORTE.linkWhatsapp(mensagem)} target="_blank" rel="noreferrer">
          <MessageCircle aria-hidden />
          Chamar no WhatsApp
        </a>
        <a className="botao botao-secundario" href={SUPORTE.linkEmail(assunto ? `Suporte: ${assunto}` : 'Suporte técnico')}>
          <Mail aria-hidden />
          Enviar e-mail
        </a>
      </div>
    </aside>
  );
}
