import '@testing-library/jest-dom';

// Universal mock for window.__VR_UI_INTERNALS if needed globally, 
// but we will test its presence
if (typeof global.window === 'undefined') {
    global.window = {};
}
if (typeof global.document === 'undefined') {
    global.document = { createElement: () => ({}) };
}

global.window.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // Deprecated
    removeListener: () => {}, // Deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock Canvas (needed for Three.js)
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = () => {
    return {
      fillRect: () => {},
      clearRect: () => {},
      getImageData: (x, y, w, h) => ({
        data: new Array(w * h * 4)
      }),
      putImageData: () => {},
      createImageData: () => [],
      setTransform: () => {},
      drawImage: () => {},
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      arc: () => {},
      fill: () => {},
      measureText: () => ({ width: 0 }),
      transform: () => {},
      rect: () => {},
      clip: () => {},
    }
  };
}

const { EventEmitter } = require('events');
EventEmitter.defaultMaxListeners = 100;
