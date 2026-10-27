import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, ExternalLink, FileText, LogIn } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';
import { ErroApi, urlDoArquivo } from '../api/cliente';
import { detalharDocumento } from '../api/portal';
import type { Documento } from '../api/tipos';
import { BlocoSuporte } from '../componentes/BlocoSuporte';
import { AvisoErro, Carregando, EstadoVazio } from '../componentes/Estados';
import { SeloVisibilidade } from '../componentes/SeloVisibilidade';
import { useAutenticacao } from '../contexto/Autenticacao';
import { data, resumoDoConteudo } from '../lib/formatar';
import { IDIOMAS, SEGMENTOS, TIPOS } from '../lib/rotulos';
import { enderecoDoPlayer } from '../lib/videos';
import './DocumentoDetalhe.css';

type TipoDeVisualizacao = 'pdf' | 'video' | 'imagem' | 'incorporado' | 'link' | 'download';

function comoVisualizar(documento: Documento): TipoDeVisualizacao {
  if (documento.origem === 'LINK') return enderecoDoPlayer(documento.urlExterna) ? 'incorporado' : 'link';
  const mime = documento.arquivo?.mime ?? '';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'imagem';
  return 'download';
}

export function DocumentoDetalhe() {
  const { id = '' } = useParams();
  const local = useLocation();
  const { ehAdmin } = useAutenticacao();
  const consulta = useQuery({
    queryKey: ['documento', id],
    queryFn: () => detalharDocumento(id),
    staleTime: 60_000,
  });

  if (consulta.isPending) return <Carregando texto="Abrindo documento..." />;

  if (consulta.isError) {
    const erro = consulta.error;
    const voltarPara = encodeURIComponent(local.pathname);
    return (
      <div className="conteiner pagina">
        <Link to="/documentos" className="voltar">
          <ArrowLeft aria-hidden /> Manuais e vídeos
        </Link>
        {erro instanceof ErroApi && erro.status === 401 ? (
          <EstadoVazio
            titulo="Este material é exclusivo para clientes"
            nivel={1}
            acao={
              <div className="grupo-botoes">
                <Link to={`/entrar?voltar=${voltarPara}`} className="botao botao-principal">
                  <LogIn aria-hidden /> Entrar para abrir
                </Link>
                <Link to="/solicitar-acesso" className="botao botao-secundario">
                  Solicitar acesso
                </Link>
              </div>
            }
          >
            Entre com sua conta para ver este documento. Ainda não tem cadastro? Peça acesso à equipe FERSA.
          </EstadoVazio>
        ) : erro instanceof ErroApi && erro.status === 404 ? (
          <EstadoVazio
            titulo="Documento não encontrado"
            nivel={1}
            acao={
              <Link to="/documentos" className="botao botao-secundario">
                Ver todos os documentos
              </Link>
            }
          >
            O link pode estar desatualizado ou este material não está liberado para a sua conta.
          </EstadoVazio>
        ) : (
          <AvisoErro erro={erro} />
        )}
      </div>
    );
  }

  const documento = consulta.data;
  const tipo = TIPOS[documento.tipo];
  const Icone = tipo.icone;
  const visualizacao = comoVisualizar(documento);
  const enderecoAbrir = urlDoArquivo(documento.id);
  const enderecoBaixar = urlDoArquivo(documento.id, { download: true });
  const player = enderecoDoPlayer(documento.urlExterna);
  const assuntoSuporte = documento.produtos[0] ? `a peça ${documento.produtos[0].codigo}` : documento.titulo;

  return (
    <div className="conteiner pagina documento">
      <title>{`${documento.titulo} | FERSA Care`}</title>

      <Link to="/documentos" className="voltar">
        <ArrowLeft aria-hidden /> Manuais e vídeos
      </Link>

      <header className="documento-cabecalho">
        <p className="documento-tipo">
          <Icone aria-hidden />
          {tipo.singular}
        </p>
        <h1 className="documento-titulo">{documento.titulo}</h1>
        <div className="documento-etiquetas">
          {documento.produtos.map((produto) => (
            <Link key={produto.id} to={`/produtos/${produto.id}`} className="etiqueta-codigo">
              {produto.codigo}
            </Link>
          ))}
          <SeloVisibilidade documento={documento} visao={ehAdmin ? 'admin' : 'portal'} />
        </div>
        {documento.descricao && <p className="documento-descricao">{documento.descricao}</p>}
      </header>

      <div className="documento-grade">
        <section className="documento-conteudo" aria-label="Conteúdo do documento">
          {visualizacao === 'video' && (
            // eslint-disable-next-line jsx-a11y/media-has-caption -- o portal ainda não guarda arquivo de legendas para os vídeos enviados
            <video className="documento-video" controls preload="metadata" playsInline src={enderecoAbrir}>
              Seu navegador não reproduz este vídeo. <a href={enderecoBaixar}>Baixe o arquivo</a>.
            </video>
          )}

          {visualizacao === 'incorporado' && player && (
            <div className="documento-incorporado">
              <iframe
                src={player}
                title={documento.titulo}
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          )}

          {visualizacao === 'imagem' && (
            <img className="documento-imagem" src={enderecoAbrir} alt={documento.titulo} />
          )}

          {visualizacao === 'pdf' && (
            <div className="documento-pdf">
              <iframe src={enderecoAbrir} title={`Pré-visualização: ${documento.titulo}`} loading="lazy" />
            </div>
          )}

          {(visualizacao === 'download' || visualizacao === 'link') && (
            <div className="documento-sem-previa">
              {visualizacao === 'link' ? <ExternalLink aria-hidden /> : <FileText aria-hidden />}
              <p>
                {visualizacao === 'link'
                  ? 'Este material fica em outro site. Ele abre numa nova aba.'
                  : 'Este formato não abre no navegador. Baixe o arquivo para ver no seu aparelho.'}
              </p>
            </div>
          )}

          <div className="grupo-botoes documento-acoes">
            {visualizacao === 'pdf' && (
              <a className="botao botao-principal botao-grande" href={enderecoAbrir} target="_blank" rel="noreferrer">
                <FileText aria-hidden /> Abrir PDF
              </a>
            )}
            {(visualizacao === 'link' || visualizacao === 'incorporado') && documento.urlExterna && (
              <a
                className={`botao botao-grande ${visualizacao === 'link' ? 'botao-principal' : 'botao-secundario'}`}
                href={documento.urlExterna}
                target="_blank"
                rel="noreferrer noopener"
              >
                <ExternalLink aria-hidden /> {visualizacao === 'link' ? 'Abrir link' : 'Abrir no site do vídeo'}
              </a>
            )}
            {documento.origem === 'ARQUIVO' && (
              <a
                className={`botao botao-grande ${visualizacao === 'download' ? 'botao-principal' : 'botao-secundario'}`}
                href={enderecoBaixar}
                download
              >
                <Download aria-hidden /> Baixar ({resumoDoConteudo(documento)})
              </a>
            )}
          </div>
        </section>

        <aside className="documento-lateral">
          <dl className="documento-dados">
            <div>
              <dt>Formato</dt>
              <dd>{resumoDoConteudo(documento)}</dd>
            </div>
            <div>
              <dt>Idioma</dt>
              <dd>{IDIOMAS[documento.idioma] ?? documento.idioma}</dd>
            </div>
            <div>
              <dt>Atualizado em</dt>
              <dd>{data(documento.atualizadoEm)}</dd>
            </div>
          </dl>

          {documento.produtos.length > 0 && (
            <div className="documento-produtos">
              <h2>Peças relacionadas</h2>
              <ul>
                {documento.produtos.map((produto) => (
                  <li key={produto.id}>
                    <Link to={`/produtos/${produto.id}`}>
                      <span className="codigo documento-produto-codigo">{produto.codigo}</span>
                      <span className="documento-produto-nome">{produto.nome}</span>
                      <span className="documento-produto-segmento">{SEGMENTOS[produto.segmento]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      <div className="secao">
        <BlocoSuporte titulo="Ainda com dúvida sobre esta peça?" assunto={assuntoSuporte} />
      </div>
    </div>
  );
}
