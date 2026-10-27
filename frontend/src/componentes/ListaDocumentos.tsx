import { ChevronRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import type { Documento } from '../api/tipos';
import { formatoDoArquivo, tamanhoDeArquivo } from '../lib/formatar';
import { TIPOS } from '../lib/rotulos';
import { SeloVisibilidade } from './SeloVisibilidade';
import './ListaDocumentos.css';

const MAXIMO_DE_CODIGOS = 3;

/** Descrição curta do conteúdo: "PDF, 2,6 MB", "Vídeo MP4" ou "Link externo". */
export function resumoDoConteudo(documento: Documento): string {
  if (documento.origem === 'LINK') return 'Link externo';
  const formato = formatoDoArquivo(documento.arquivo?.nome);
  const tamanho = tamanhoDeArquivo(documento.arquivo?.tamanho);
  return tamanho ? `${formato}, ${tamanho}` : formato;
}

export function ItemDocumento({
  documento,
  visao = 'portal',
  destino,
}: {
  documento: Documento;
  visao?: 'portal' | 'admin';
  destino?: string;
}) {
  const tipo = TIPOS[documento.tipo];
  const Icone = tipo.icone;
  const codigos = documento.produtos.slice(0, MAXIMO_DE_CODIGOS);
  const restantes = documento.produtos.length - codigos.length;

  return (
    <li className="item-documento">
      <Link to={destino ?? `/documentos/${documento.id}`} className="item-documento-link">
        <span className={`item-documento-icone tipo-${documento.tipo.toLowerCase()}`} aria-hidden>
          <Icone />
        </span>
        <span className="item-documento-corpo">
          <span className="item-documento-titulo">{documento.titulo}</span>
          <span className="item-documento-meta">
            <span>{tipo.singular}</span>
            <span className="item-documento-formato">
              {documento.origem === 'LINK' && <ExternalLink aria-hidden />}
              {resumoDoConteudo(documento)}
            </span>
            {codigos.map((produto) => (
              <span key={produto.id} className="etiqueta-codigo">
                {produto.codigo}
              </span>
            ))}
            {restantes > 0 && <span className="item-documento-mais">+{restantes}</span>}
            <SeloVisibilidade documento={documento} visao={visao} />
          </span>
        </span>
        <ChevronRight className="item-documento-seta" aria-hidden />
      </Link>
    </li>
  );
}

export function ListaDocumentos({
  documentos,
  visao = 'portal',
  rotulo,
}: {
  documentos: Documento[];
  visao?: 'portal' | 'admin';
  rotulo?: string;
}) {
  return (
    <ul className="lista-documentos" aria-label={rotulo}>
      {documentos.map((documento) => (
        <ItemDocumento key={documento.id} documento={documento} visao={visao} />
      ))}
    </ul>
  );
}
