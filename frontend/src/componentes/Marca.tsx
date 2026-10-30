// Usa o logotipo oficial em src/assets/marca/ se existir (nunca redesenhar); sem ele, o nome em texto.
const arquivosDoLogotipo = import.meta.glob<string>('../assets/marca/fersa.{svg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});
const LOGOTIPO_OFICIAL = Object.values(arquivosDoLogotipo)[0];

export function Marca({ tamanho = 'normal' }: { tamanho?: 'normal' | 'pequeno' }) {
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
