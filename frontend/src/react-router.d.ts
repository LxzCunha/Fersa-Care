import type { NavigateOptions, To } from 'react-router';

/**
 * O site usa o <BrowserRouter> (modo declarativo), em que navegar() não
 * devolve Promise. O React Router tipa o retorno como `void | Promise<void>`
 * para servir também ao modo de dados e recomenda esta declaração para o modo
 * declarativo; sem ela, o ESLint pediria `void` em cada navegar().
 */
declare module 'react-router' {
  interface NavigateFunction {
    (to: To, options?: NavigateOptions): void;
    (delta: number): void;
  }
}
