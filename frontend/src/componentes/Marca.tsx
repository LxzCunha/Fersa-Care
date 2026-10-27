/**
 * Logotipo do portal.
 *
 * O logotipo oficial da FERSA é usado automaticamente quando o arquivo existe
 * em src/assets/marca/ (fersa.svg, fersa.png ou fersa.webp, versão azul sobre
 * fundo claro). Sem o arquivo, aparece o nome em texto com a cor da marca.
 */
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
      <span className="marca-care">Care</span>
    </span>
  );
}
