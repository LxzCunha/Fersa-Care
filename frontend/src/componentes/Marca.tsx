import logotipo from '../assets/marca/fersa.svg';
import logotipoNegativo from '../assets/marca/fersa-negativo.svg';

// Logotipo oficial + separador (o símbolo) + "Care", como no "Separator Element" do manual (pág. 36).
// Fundo claro: logotipo em Fersa Origin; fundo escuro ou imagem: `negativa`.
export function Marca({ tamanho = 'normal', negativa = false }: { tamanho?: 'normal' | 'pequeno'; negativa?: boolean }) {
  return (
    <span className={`marca marca-${tamanho}`}>
      {LOGOTIPO_OFICIAL ? (
        <img className="marca-logotipo" src={LOGOTIPO_OFICIAL} alt="FERSA" />
      ) : (
        <span className="marca-nome">FERSA</span>
      )}
      <span className="marca-care">CARE</span>
    </span>
  );
}
