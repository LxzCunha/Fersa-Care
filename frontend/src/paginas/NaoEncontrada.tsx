import { Link } from 'react-router';
import { EstadoVazio } from '../componentes/Estados';

export function NaoEncontrada() {
  return (
    <div className="conteiner pagina">
      <title>Página não encontrada | FERSA Care</title>
      <EstadoVazio
        titulo="Página não encontrada"
        nivel={1}
        acao={
          <div className="grupo-botoes">
            <Link to="/" className="botao botao-principal">
              Ir para o início
            </Link>
            <Link to="/documentos" className="botao botao-secundario">
              Buscar documentos
            </Link>
          </div>
        }
      >
        O endereço pode ter sido digitado errado ou a página mudou de lugar.
      </EstadoVazio>
    </div>
  );
}
