import type { CSSProperties } from 'react';
import './DesenhoRolamento.css';

const CENTRO_X = 150;
const CENTRO_Y = 150;
const RAIO_PRIMITIVO = 75;
const QUANTIDADE_ESFERAS = 9;

const esferas = Array.from({ length: QUANTIDADE_ESFERAS }, (_, indice) => {
  const angulo = (indice / QUANTIDADE_ESFERAS) * Math.PI * 2 - Math.PI / 2;
  return {
    x: CENTRO_X + RAIO_PRIMITIVO * Math.cos(angulo),
    y: CENTRO_Y + RAIO_PRIMITIVO * Math.sin(angulo),
  };
});

/** Permite passar variáveis CSS (--nome) pelo atributo style. */
function variaveis(valores: Record<string, string | number>): CSSProperties {
  return valores;
}

function Seta({ x, y, direcao }: { x: number; y: number; direcao: 'esquerda' | 'direita' | 'cima' | 'baixo' }) {
  const pontas = {
    esquerda: `${x},${y} ${x + 7},${y - 3.5} ${x + 7},${y + 3.5}`,
    direita: `${x},${y} ${x - 7},${y - 3.5} ${x - 7},${y + 3.5}`,
    cima: `${x},${y} ${x - 3.5},${y + 7} ${x + 3.5},${y + 7}`,
    baixo: `${x},${y} ${x - 3.5},${y - 7} ${x + 3.5},${y - 7}`,
  };
  return <polygon className="desenho-seta" points={pontas[direcao]} />;
}

export function DesenhoRolamento({ className = '' }: { className?: string }) {
  return (
    <svg className={`desenho-rolamento ${className}`} viewBox="0 0 440 300" aria-hidden focusable="false">
      <defs>
        <pattern id="hachura" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" className="desenho-hachura" />
        </pattern>
      </defs>

      <line className="desenho-centro" x1="18" y1={CENTRO_Y} x2="428" y2={CENTRO_Y} />
      <line className="desenho-centro" x1={CENTRO_X} y1="22" x2={CENTRO_X} y2="278" />

      {/* Vista frontal */}
      <g className="desenho-peca">
        <circle cx={CENTRO_X} cy={CENTRO_Y} r="110" />
        <circle cx={CENTRO_X} cy={CENTRO_Y} r="92" />
        <circle cx={CENTRO_X} cy={CENTRO_Y} r="58" />
        <circle cx={CENTRO_X} cy={CENTRO_Y} r="40" />
        <circle className="desenho-gaiola" cx={CENTRO_X} cy={CENTRO_Y} r={RAIO_PRIMITIVO} />
        {esferas.map((esfera, indice) => (
          <circle key={indice} className="desenho-esfera" cx={esfera.x} cy={esfera.y} r="14.5" />
        ))}
      </g>

      {/* Corte lateral */}
      <g className="desenho-peca">
        {[40, 242, 92, 190].map((y) => (
          <rect key={y} x="330" y={y} width="40" height="18" fill="url(#hachura)" />
        ))}
        <circle className="desenho-esfera" cx="350" cy="75" r="14.5" />
        <circle className="desenho-esfera" cx="350" cy="225" r="14.5" />
      </g>

      <g className="desenho-cota-grupo" style={variaveis({ '--atraso': '0.2s' })}>
        <line className="desenho-extensao" x1="40" y1="158" x2="40" y2="292" />
        <line className="desenho-extensao" x1="260" y1="158" x2="260" y2="292" />
        <line className="desenho-cota" x1="41" y1="285" x2="259" y2="285" style={variaveis({ '--comprimento': 218 })} />
        <Seta x={41} y={285} direcao="esquerda" />
        <Seta x={259} y={285} direcao="direita" />
        <text className="desenho-rotulo" x={CENTRO_X} y="278">
          D
        </text>
      </g>

      <g className="desenho-cota-grupo" style={variaveis({ '--atraso': '0.45s' })}>
        <line className="desenho-extensao" x1="374" y1="110" x2="404" y2="110" />
        <line className="desenho-extensao" x1="374" y1="190" x2="404" y2="190" />
        <line className="desenho-cota" x1="397" y1="111" x2="397" y2="189" style={variaveis({ '--comprimento': 78 })} />
        <Seta x={397} y={111} direcao="cima" />
        <Seta x={397} y={189} direcao="baixo" />
        <text className="desenho-rotulo desenho-rotulo-lateral" x="407" y="157">
          d
        </text>
      </g>

      <g className="desenho-cota-grupo" style={variaveis({ '--atraso': '0.7s' })}>
        <line className="desenho-extensao" x1="330" y1="36" x2="330" y2="14" />
        <line className="desenho-extensao" x1="370" y1="36" x2="370" y2="14" />
        <line className="desenho-cota" x1="331" y1="22" x2="369" y2="22" style={variaveis({ '--comprimento': 38 })} />
        <Seta x={331} y={22} direcao="esquerda" />
        <Seta x={369} y={22} direcao="direita" />
        <text className="desenho-rotulo" x="350" y="14">
          B
        </text>
      </g>
    </svg>
  );
}
