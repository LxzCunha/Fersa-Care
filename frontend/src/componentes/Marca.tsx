import logotipo from '../assets/marca/fersa.svg';
import logotipoNegativo from '../assets/marca/fersa-negativo.svg';

// Logotipo oficial + separador (o símbolo) + "Care", como no "Separator Element" do manual (pág. 36).
// Fundo claro: logotipo em Fersa Origin; fundo escuro ou imagem: `negativa`.
export function Marca({ tamanho = 'normal', negativa = false }: { tamanho?: 'normal' | 'pequeno'; negativa?: boolean }) {
  return (
    <span className={`marca marca-${tamanho}${negativa ? ' marca-negativa' : ''}`}>
      <img className="marca-logotipo" src={negativa ? logotipoNegativo : logotipo} alt="FERSA" />
      <span className="marca-separador" aria-hidden="true" />
      <span className="marca-care">Care</span>
    </span>
  );
}
