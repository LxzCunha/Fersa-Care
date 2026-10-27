import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Preparação de cada arquivo de teste: matchers do jest-dom
 * (toBeInTheDocument, toHaveAttribute...) e o que falta no jsdom.
 */

afterEach(() => cleanup());

// <dialog>: o jsdom não abre nem fecha a janela de verdade.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}

// Menu do admin pergunta se a tela é de desktop.
if (!window.matchMedia) {
  window.matchMedia = (consulta: string) =>
    ({
      matches: false,
      media: consulta,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// Pré-visualização de imagens escolhidas.
URL.createObjectURL ??= () => 'blob:previa-de-teste';
URL.revokeObjectURL ??= () => undefined;

// Rolagens (ao trocar de página, ao mostrar um erro na janela).
window.scrollTo = () => undefined;
Element.prototype.scrollTo = () => undefined;
