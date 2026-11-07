import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom has no matchMedia; uPlot reads it when it loads.
if (typeof (window as Partial<Window>).matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

// jsdom has no ResizeObserver or scrollIntoView; cmdk and Radix Popover call them (Select).
const nothing = (): undefined => undefined;
if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: class {
      observe = nothing;
      unobserve = nothing;
      disconnect = nothing;
    },
  });
}
if (!('scrollIntoView' in Element.prototype)) {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: nothing,
  });
}

afterEach(() => {
  cleanup();
});
