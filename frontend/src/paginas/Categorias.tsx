import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { listarCategorias } from '../api/portal';
import type { Categoria } from '../api/tipos';
import { AvisoErro, Carregando, EstadoVazio } from '../componentes/Estados';
import { Trilha } from '../componentes/Trilha';
import { plural } from '../lib/formatar';
import './Categorias.css';

export function Categorias() {
  const consulta = useQuery({ queryKey: ['categorias'], queryFn: listarCategorias });

  return (
    <div className="conteiner pagina">
      <title>Categorias | Catálogo | FERSA Care</title>
      <Trilha itens={[{ rotulo: 'Catálogo', para: '/produtos' }, { rotulo: 'Categorias' }]} />

      <header className="pagina-cabecalho">
        <h1>Categorias</h1>
        <p className="pagina-descricao">Escolha o tipo de peça para ver o catálogo e os materiais técnicos.</p>
      </header>

      {consulta.isPending && <Carregando texto="Carregando categorias..." />}
      {consulta.isError && <AvisoErro erro={consulta.error} />}
      {consulta.data &&
        (consulta.data.length === 0 ? (
          <EstadoVazio titulo="Ainda não há categorias no catálogo" />
        ) : (
          <>
            <ListaCategorias categorias={consulta.data} />
            <Link to="/produtos" className="link-seta categorias-todas">
              Ver todas as peças <ArrowRight aria-hidden />
            </Link>
          </>
        ))}
    </div>
  );
}

export function ListaCategorias({ categorias }: { categorias: Categoria[] }) {
  return (
    <ul className="lista-categorias">
      {categorias.map((categoria) => (
        <li key={categoria.id}>
          <Link to={`/produtos?categoria=${categoria.id}`} className="categoria-link">
            <span className="categoria-nome">{categoria.nome}</span>
            <span className="categoria-contagem">{plural(categoria.totalProdutos, 'peça', 'peças')}</span>
            <ChevronRight className="categoria-seta" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
