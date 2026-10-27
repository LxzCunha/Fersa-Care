import { Link } from 'react-router';

export function Trilha({ itens }: { itens: { rotulo: string; para?: string }[] }) {
  return (
    <nav className="trilha" aria-label="Você está em">
      <ol>
        <li>
          <Link to="/">Início</Link>
        </li>
        {itens.map((item, indice) => (
          <li key={`${item.rotulo}-${indice}`}>
            {item.para && indice < itens.length - 1 ? (
              <Link to={item.para}>{item.rotulo}</Link>
            ) : (
              <span aria-current="page">{item.rotulo}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
