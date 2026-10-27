import { Download, ExternalLink, Play } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import type { Documento } from '../api/tipos';
import { resumoDoConteudo } from '../lib/formatar';
import { TIPOS } from '../lib/rotulos';
import { SeloVisibilidade } from './SeloVisibilidade';
import './CartaoDocumento.css';

const MAXIMO_DE_CODIGOS = 3;

/**
 * Capa do documento (miniatura gerada pela API). Sem capa, ou se ela não
 * carregar, uma capa desenhada com o ícone do tipo: uma folha para documentos
 * e uma tela para vídeos. Decorativa: o título já está no cartão.
 */
export function CapaDocumento({ documento, className = '' }: { documento: Documento; className?: string }) {
  const [falhou, setFalhou] = useState(false);
  const ehVideo = documento.tipo === 'VIDEO';
  const Icone = TIPOS[documento.tipo].icone;

  return (
    <div className={`capa-documento ${className}`} aria-hidden>
      {documento.capaUrl && !falhou ? (
        <>
          <img src={documento.capaUrl} alt="" loading="lazy" decoding="async" onError={() => setFalhou(true)} />
          {ehVideo && (
            <span className="capa-documento-play">
              <Play />
            </span>
          )}
        </>
      ) : (
        <span className={`capa-substituta ${ehVideo ? 'capa-substituta-video' : ''}`}>
          <Icone />
        </span>
      )}
    </div>
  );
}

/**
 * Cartão de documento, no modelo de portal de pós-venda: título em cima com o
 * atalho para baixar, a capa em destaque e o tipo, o formato e as peças embaixo.
 * O cartão inteiro abre o documento; o botão de baixar fica por cima.
 */
export function CartaoDocumento({ documento }: { documento: Documento }) {
  const codigos = documento.produtos.slice(0, MAXIMO_DE_CODIGOS);
  const restantes = documento.produtos.length - codigos.length;
  const resumo = resumoDoConteudo(documento);
  const conteudo = `/api/documentos/${documento.id}/arquivo`;

  return (
    <li className="cartao-documento">
      <Link to={`/documentos/${documento.id}`} className="cartao-documento-titulo">
        <span>{documento.titulo}</span>
      </Link>

      {documento.origem === 'LINK' ? (
        <a
          href={conteudo}
          target="_blank"
          rel="noreferrer"
          className="cartao-documento-acao"
          aria-label={`Abrir “${documento.titulo}” em nova aba`}
          title="Abrir em nova aba"
        >
          <ExternalLink aria-hidden />
        </a>
      ) : (
        <a
          href={`${conteudo}?download=1`}
          download
          className="cartao-documento-acao"
          aria-label={`Baixar “${documento.titulo}” (${resumo})`}
          title={`Baixar (${resumo})`}
        >
          <Download aria-hidden />
        </a>
      )}

      <CapaDocumento key={documento.capaUrl} documento={documento} className="cartao-documento-capa" />

      <div className="cartao-documento-meta">
        <span>
          {TIPOS[documento.tipo].singular} · <span className="cartao-documento-formato">{resumo}</span>
        </span>
        <span className="cartao-documento-etiquetas">
          {codigos.map((produto) => (
            <span key={produto.id} className="etiqueta-codigo">
              {produto.codigo}
            </span>
          ))}
          {restantes > 0 && <span className="cartao-documento-mais">+{restantes}</span>}
          <SeloVisibilidade documento={documento} visao="portal" />
        </span>
      </div>
    </li>
  );
}

export function GradeDocumentos({ documentos, rotulo }: { documentos: Documento[]; rotulo?: string }) {
  return (
    <ul className="grade-documentos" aria-label={rotulo}>
      {documentos.map((documento) => (
        <CartaoDocumento key={documento.id} documento={documento} />
      ))}
    </ul>
  );
}
