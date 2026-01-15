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
