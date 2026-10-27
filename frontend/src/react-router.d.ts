import type { NavigateOptions, To } from 'react-router';

// No modo declarativo navegar() não devolve Promise; sem isto o ESLint pediria `void` em cada chamada.
declare module 'react-router' {
  interface NavigateFunction {
    (to: To, options?: NavigateOptions): void;
    (delta: number): void;
  }
}
