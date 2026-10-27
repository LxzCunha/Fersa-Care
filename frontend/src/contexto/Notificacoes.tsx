import { CircleAlert, CircleCheck } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

/** Mensagens rápidas no rodapé da tela ("Documento salvo", "Usuário aprovado"...). */

type TipoNotificacao = 'ok' | 'erro';
type Notificar = (mensagem: string, tipo?: TipoNotificacao) => void;

interface Notificacao {
  id: number;
  mensagem: string;
  tipo: TipoNotificacao;
}

const ContextoNotificacoes = createContext<Notificar>(() => undefined);

let proximoId = 1;

export function ProvedorNotificacoes({ children }: { children: ReactNode }) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);

  const notificar = useCallback<Notificar>((mensagem, tipo = 'ok') => {
    const id = proximoId++;
    setNotificacoes((atuais) => [...atuais.slice(-2), { id, mensagem, tipo }]);
    window.setTimeout(() => {
      setNotificacoes((atuais) => atuais.filter((notificacao) => notificacao.id !== id));
    }, 4500);
  }, []);

  return (
    <ContextoNotificacoes value={notificar}>
      {children}
      <div className="notificacoes" role="status" aria-live="polite">
        {notificacoes.map((notificacao) => (
          <div key={notificacao.id} className={`notificacao notificacao-${notificacao.tipo}`}>
            {notificacao.tipo === 'ok' ? <CircleCheck aria-hidden /> : <CircleAlert aria-hidden />}
            <span>{notificacao.mensagem}</span>
          </div>
        ))}
      </div>
    </ContextoNotificacoes>
  );
}

export function useNotificar(): Notificar {
  return useContext(ContextoNotificacoes);
}
