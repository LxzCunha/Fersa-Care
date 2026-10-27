import { ArrowRight, Search, X } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import './CampoBusca.css';

export function CampoBusca({
  valorInicial = '',
  aoBuscar,
  rotulo = 'Buscar',
  placeholder = 'Referência, peça ou assunto',
  variante = 'normal',
  focarAoAbrir = false,
}: {
  valorInicial?: string;
  aoBuscar: (termo: string) => void;
  rotulo?: string;
  placeholder?: string;
  variante?: 'normal' | 'destaque';
  focarAoAbrir?: boolean;
}) {
  const [termo, setTermo] = useState(valorInicial);
  const [valorAnterior, setValorAnterior] = useState(valorInicial);
  const idCampo = useId();

  // Busca mudou pela URL (voltar do navegador): ajuste na renderização, como recomenda o React.
  if (valorInicial !== valorAnterior) {
    setValorAnterior(valorInicial);
    setTermo(valorInicial);
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    aoBuscar(termo.trim());
  }

  function limpar() {
    setTermo('');
    aoBuscar('');
  }

  return (
    <form role="search" className={`busca busca-${variante}`} onSubmit={enviar}>
      <label htmlFor={idCampo} className="visualmente-oculto">
        {rotulo}
      </label>
      <Search className="busca-icone" aria-hidden />
      <input
        id={idCampo}
        className="busca-entrada"
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        // eslint-disable-next-line jsx-a11y/no-autofocus -- só na página /busca (focarAoAbrir), que existe para digitar uma busca
        autoFocus={focarAoAbrir}
        placeholder={placeholder}
        value={termo}
        onChange={(evento) => setTermo(evento.target.value)}
      />
      {termo && (
        <button type="button" className="busca-limpar" onClick={limpar} aria-label="Limpar busca">
          <X aria-hidden />
        </button>
      )}
      <button type="submit" className="busca-enviar" aria-label="Buscar">
        <ArrowRight aria-hidden />
      </button>
    </form>
  );
}
