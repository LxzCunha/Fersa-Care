import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import type { Produto } from '../api/tipos';
import { fichaTecnica } from '../lib/medidas';
import { SEGMENTOS } from '../lib/rotulos';
import './CartaoPeca.css';

/** Foto da peça; sem foto, um desenho de rolamento no lugar (decorativo). */
export function ImagemPeca({ produto, className = '' }: { produto: Produto; className?: string }) {
  return (
    <div className={`imagem-peca ${className}`}>
      {produto.imagemUrl ? (
        <img src={produto.imagemUrl} alt="" loading="lazy" decoding="async" />
      ) : (
        <svg viewBox="0 0 64 64" aria-hidden focusable="false" className="imagem-peca-desenho">
          <circle cx="32" cy="32" r="24" />
          <circle cx="32" cy="32" r="10" />
          {Array.from({ length: 8 }, (_, indice) => {
            const angulo = (indice / 8) * Math.PI * 2;
            return <circle key={indice} className="esfera" cx={32 + 17 * Math.cos(angulo)} cy={32 + 17 * Math.sin(angulo)} r="3.6" />;
          })}
        </svg>
      )}
    </div>
  );
}

/**
 * Cartão de peça no modelo do catálogo FERSA: categoria, código em destaque,
 * nome, ficha com as medidas em cinza e a chamada para os materiais técnicos.
 */
export function CartaoPeca({ produto }: { produto: Produto }) {
  const ficha = fichaTecnica(produto);
  return (
    <Link to={`/produtos/${produto.id}`} className="cartao-peca">
      <ImagemPeca produto={produto} className="cartao-peca-imagem" />
      <div className="cartao-peca-identificacao">
        <span className="cartao-peca-categoria">{produto.categoria?.nome ?? SEGMENTOS[produto.segmento]}</span>
        <span className="cartao-peca-codigo codigo">{produto.codigo}</span>
        <span className="cartao-peca-nome">{produto.nome}</span>
      </div>
      {ficha.length > 0 && (
        <dl className="ficha-resumo">
          {ficha.map((item) => (
            <div key={item.rotulo}>
              <dt>{item.rotulo}</dt>
              <dd>{item.valor}</dd>
            </div>
          ))}
        </dl>
      )}
      <span className="cartao-peca-acao">
        Ver materiais técnicos <ArrowRight aria-hidden />
      </span>
    </Link>
  );
}
