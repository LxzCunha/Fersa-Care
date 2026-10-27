import { CircleAlert, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { mensagemDeErro } from '../api/cliente';

/** Estados comuns das telas: carregando, erro e lista vazia. */

export function Carregando({ texto = 'Carregando...' }: { texto?: string }) {
  return (
    <div className="carregando conteiner" role="status">
      <LoaderCircle className="girando" aria-hidden />
      <span>{texto}</span>
    </div>
  );
}

export function AvisoErro({ erro, children }: { erro?: unknown; children?: ReactNode }) {
  return (
    <div className="aviso aviso-erro" role="alert">
      <CircleAlert aria-hidden />
      <div>{children ?? mensagemDeErro(erro)}</div>
    </div>
  );
}

export function EstadoVazio({
  titulo,
  children,
  acao,
  nivel = 2,
}: {
  titulo: string;
  children?: ReactNode;
  acao?: ReactNode;
  /** Use 1 quando o estado vazio é o conteúdo principal da página (ex.: "não encontrado"). */
  nivel?: 1 | 2;
}) {
  const Titulo = nivel === 1 ? 'h1' : 'h2';
  return (
    <div className="vazio">
      <Titulo className="vazio-titulo">{titulo}</Titulo>
      {children && <p>{children}</p>}
      {acao}
    </div>
  );
}
