import { useEffect, useId, useRef } from 'react';

export function DialogoConfirmacao({
  aberto,
  titulo,
  mensagem,
  textoConfirmar,
  perigoso = false,
  processando = false,
  aoConfirmar,
  aoCancelar,
}: {
  aberto: boolean;
  titulo: string;
  mensagem: string;
  textoConfirmar: string;
  perigoso?: boolean;
  processando?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}) {
  const referencia = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const dialogo = referencia.current;
    if (!dialogo) return;
    if (aberto && !dialogo.open) dialogo.showModal();
    if (!aberto && dialogo.open) dialogo.close();
  }, [aberto]);

  return (
    <dialog
      ref={referencia}
      className="dialogo"
      aria-labelledby={idTitulo}
      onCancel={(evento) => {
        evento.preventDefault();
        aoCancelar();
      }}
    >
      <div className="dialogo-conteudo">
        <h2 id={idTitulo}>{titulo}</h2>
        <p>{mensagem}</p>
        <div className="dialogo-acoes">
          <button type="button" className="botao botao-secundario" onClick={aoCancelar} disabled={processando}>
            Cancelar
          </button>
          <button
            type="button"
            className={`botao ${perigoso ? 'botao-perigo' : 'botao-principal'}`}
            onClick={aoConfirmar}
            disabled={processando}
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </dialog>
  );
}
