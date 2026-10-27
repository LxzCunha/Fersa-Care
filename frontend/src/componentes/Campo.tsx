import type { InputHTMLAttributes, ReactNode } from 'react';

/**
 * Rótulo + controle + ajuda/erro, com as ligações de acessibilidade prontas
 * (aria-invalid e aria-describedby). `children` recebe esses atributos.
 */
export function Campo({
  id,
  rotulo,
  erro,
  ajuda,
  opcional = false,
  children,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  ajuda?: ReactNode;
  opcional?: boolean;
  children: (atributos: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
}) {
  const idDescricao = erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined;
  return (
    <div className="campo">
      <label className="campo-rotulo" htmlFor={id}>
        {rotulo}
        {opcional && <span className="opcional"> (opcional)</span>}
      </label>
      {children({ id, 'aria-invalid': Boolean(erro), 'aria-describedby': idDescricao })}
      {erro ? (
        <span id={`${id}-erro`} className="campo-erro">
          {erro}
        </span>
      ) : (
        ajuda && (
          <span id={`${id}-ajuda`} className="campo-ajuda">
            {ajuda}
          </span>
        )
      )}
    </div>
  );
}

/** Atalho para o caso mais comum: um <input> de texto. */
export function CampoTexto({
  id,
  rotulo,
  erro,
  ajuda,
  opcional,
  ...atributosDoInput
}: {
  id: string;
  rotulo: string;
  erro?: string;
  ajuda?: ReactNode;
  opcional?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>) {
  return (
    <Campo id={id} rotulo={rotulo} erro={erro} ajuda={ajuda} opcional={opcional}>
      {(atributos) => <input className="entrada" {...atributosDoInput} {...atributos} />}
    </Campo>
  );
}
