import type { CSSProperties } from 'react';
import { numero, plural } from '../../lib/formatar';

function escalaArredondada(maximo: number): number {
  if (maximo <= 4) return 4;
  const ordem = 10 ** Math.floor(Math.log10(maximo));
  for (const passo of [1, 2, 2.5, 5, 10]) {
    if (passo * ordem >= maximo) return passo * ordem;
  }
  return 10 * ordem;
}

function diaCurto(dia: string): string {
  const [, mes, diaDoMes] = dia.split('-');
  return `${diaDoMes}/${mes}`;
}

function diaLongo(dia: string): string {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${dia}T12:00:00Z`))
    .replace(/\./g, '');
}

export function GraficoAcessos({ dados }: { dados: { dia: string; total: number }[] }) {
  const maximo = Math.max(0, ...dados.map((item) => item.total));
  const escala = escalaArredondada(maximo);
  const marcas = [escala, escala / 2, 0];
  const indiceHoje = dados.length - 1;
  const indiceMaximo = dados.findIndex((item) => item.total === maximo && maximo > 0);

  return (
    <div>
      <div className="grafico">
        <div className="grafico-eixo" aria-hidden="true">
          {marcas.map((marca) => (
            <span key={marca} style={{ bottom: `${(marca / escala) * 100}%` }}>
              {numero(marca)}
            </span>
          ))}
        </div>

        <div className="grafico-area">
          {marcas.slice(0, -1).map((marca) => (
            <div key={marca} className="grafico-linha-grade" style={{ bottom: `${(marca / escala) * 100}%` }} />
          ))}
          <div className="grafico-colunas">
            {dados.map((item, indice) => {
              const ehHoje = indice === indiceHoje;
              const mostrarValor = item.total > 0 && (ehHoje || indice === indiceMaximo);
              return (
                <div
                  key={item.dia}
                  className={`grafico-coluna ${ehHoje ? 'grafico-coluna-hoje' : ''}`}
                  style={{ '--altura': `${(item.total / escala) * 100}%` } as CSSProperties}
                  // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a coluna recebe foco para mostrar a dica pelo teclado, como no mouse; os números também estão na tabela abaixo
                  tabIndex={0}
                  role="img"
                  aria-label={`${ehHoje ? 'Hoje' : diaLongo(item.dia)}: ${plural(item.total, 'abertura')}`}
                >
                  <span className="grafico-barra" />
                  {mostrarValor && (
                    <span className="grafico-valor" aria-hidden="true">
                      {numero(item.total)}
                    </span>
                  )}
                  <span className="grafico-dica" aria-hidden="true">
                    <strong>{plural(item.total, 'abertura')}</strong>
                    {ehHoje ? 'Hoje' : diaLongo(item.dia)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grafico-rotulos" aria-hidden="true">
          {dados.map((item, indice) => {
            const ehHoje = indice === indiceHoje;
            // Rótulo a cada dois dias, contando a partir de hoje, para não encavalar no celular.
            const mostrar = (indiceHoje - indice) % 2 === 0;
            return (
              <span key={item.dia} className={ehHoje ? 'rotulo-hoje' : undefined}>
                {mostrar ? (ehHoje ? 'Hoje' : diaCurto(item.dia)) : ''}
              </span>
            );
          })}
        </div>
      </div>

      <details className="grafico-tabela">
        <summary>Ver os números em tabela</summary>
        <div className="tabela-moldura">
          <table className="tabela">
            <caption className="visualmente-oculto">Aberturas de documentos por dia</caption>
            <thead>
              <tr>
                <th scope="col">Dia</th>
                <th scope="col">Aberturas</th>
              </tr>
            </thead>
            <tbody>
              {[...dados].reverse().map((item, indice) => (
                <tr key={item.dia}>
                  <td>{indice === 0 ? 'Hoje' : diaLongo(item.dia)}</td>
                  <td>{numero(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
