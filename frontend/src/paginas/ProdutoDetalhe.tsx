import { useQuery } from '@tanstack/react-query';
import { ArrowDown, MessageCircle, UserCheck } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { ErroApi } from '../api/cliente';
import { detalharProduto } from '../api/portal';
import { BlocoSuporte } from '../componentes/BlocoSuporte';
import { GradeDocumentos } from '../componentes/CartaoDocumento';
import { ImagemPeca } from '../componentes/CartaoPeca';
import { AvisoErro, Carregando, EstadoVazio } from '../componentes/Estados';
import { Trilha } from '../componentes/Trilha';
import { useAssistente } from '../contexto/Assistente';
import { useAutenticacao } from '../contexto/Autenticacao';
import { plural } from '../lib/formatar';
import { fichaTecnica } from '../lib/medidas';
import { SEGMENTOS } from '../lib/rotulos';
import './ProdutoDetalhe.css';

/** Página da peça: foto, ficha técnica e os materiais que a pessoa pode ver. */
export function ProdutoDetalhe() {
  const { id = '' } = useParams();
  const { usuario } = useAutenticacao();
  const assistente = useAssistente();
  const consulta = useQuery({ queryKey: ['produto', id], queryFn: () => detalharProduto(id) });

  if (consulta.isPending) return <Carregando texto="Carregando peça..." />;

  if (consulta.isError) {
    return (
      <div className="conteiner pagina">
        <Trilha itens={[{ rotulo: 'Catálogo', para: '/produtos' }, { rotulo: 'Peça' }]} />
        {consulta.error instanceof ErroApi && consulta.error.status === 404 ? (
          <EstadoVazio
            titulo="Peça não encontrada"
            nivel={1}
            acao={
              <Link to="/produtos" className="botao botao-secundario">
                Voltar ao catálogo
              </Link>
            }
          >
            Ela pode ter saído de linha ou o link está desatualizado.
          </EstadoVazio>
        ) : (
          <AvisoErro erro={consulta.error} />
        )}
      </div>
    );
  }

  const produto = consulta.data;
  const ficha = fichaTecnica(produto);
  const totalMateriais = produto.documentos.length;

  return (
    <div className="conteiner pagina">
      <title>{`${produto.codigo} ${produto.nome} | FERSA Care`}</title>

      <Trilha
        itens={[
          { rotulo: 'Catálogo', para: '/produtos' },
          ...(produto.categoria ? [{ rotulo: produto.categoria.nome, para: `/produtos?categoria=${produto.categoria.id}` }] : []),
          { rotulo: produto.codigo },
        ]}
      />

      <div className="peca-topo">
        <ImagemPeca produto={produto} className="peca-imagem" />

        <div className="peca-info">
          <p className="peca-categoria">
            {produto.categoria ? (
              <Link to={`/produtos?categoria=${produto.categoria.id}`}>{produto.categoria.nome}</Link>
            ) : (
              'Peça FERSA'
            )}
            <span aria-hidden> · </span>
            {SEGMENTOS[produto.segmento]}
          </p>
          <h1 className="peca-codigo codigo">{produto.codigo}</h1>
          <p className="peca-nome">{produto.nome}</p>

          {ficha.length > 0 && (
            <dl className="peca-ficha" aria-label="Medidas principais">
              {ficha.map((item) => (
                <div key={item.rotulo}>
                  <dt>{item.rotulo}</dt>
                  <dd>
                    {item.valor}
                    {item.equivalente && <span className="peca-ficha-equivalente">{item.equivalente}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <div className="grupo-botoes peca-acoes">
            <a href="#materiais" className="botao botao-principal">
              <ArrowDown aria-hidden />
              {totalMateriais > 0 ? `Ver ${plural(totalMateriais, 'material', 'materiais')}` : 'Materiais técnicos'}
            </a>
            <button
              type="button"
              className="botao botao-secundario"
              onClick={() => assistente.abrir({ rascunho: `Sobre a peça ${produto.codigo}: ` })}
            >
              <MessageCircle aria-hidden /> Dúvida sobre a peça
            </button>
          </div>
        </div>
      </div>

      {(produto.aplicacoes || produto.descricao) && (
        <div className="peca-textos">
          {produto.aplicacoes && (
            <section>
              <h2>Aplicações</h2>
              <p>{produto.aplicacoes}</p>
            </section>
          )}
          {produto.descricao && (
            <section>
              <h2>Sobre a peça</h2>
              <p>{produto.descricao}</p>
            </section>
          )}
        </div>
      )}

      <section id="materiais" className="peca-materiais" aria-labelledby="titulo-materiais">
        <h2 id="titulo-materiais" className="secao-titulo">
          Materiais técnicos desta peça
        </h2>
        {totalMateriais > 0 ? (
          <GradeDocumentos documentos={produto.documentos} rotulo={`Materiais da peça ${produto.codigo}`} />
        ) : (
          <EstadoVazio titulo="Ainda não há materiais para esta peça">
            Fale com o suporte técnico: respondemos dúvidas de montagem e aplicação.
          </EstadoVazio>
        )}
        {!usuario && (
          <p className="aviso aviso-info peca-aviso">
            <UserCheck aria-hidden />
            <span>
              Clientes cadastrados podem ver materiais exclusivos.{' '}
              <Link to={`/entrar?voltar=/produtos/${produto.id}`}>Entrar</Link>
            </span>
          </p>
        )}
      </section>

      <div className="secao">
        <BlocoSuporte titulo="Dúvida sobre esta peça?" assunto={`a peça ${produto.codigo}`} />
      </div>
    </div>
  );
}
