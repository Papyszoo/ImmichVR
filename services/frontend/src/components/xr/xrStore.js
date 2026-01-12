import { createXRStore } from '@react-three/xr';

// Create XR store for managing VR sessions
const xrStore = createXRStore();

// Export store for external access
if (typeof window !== 'undefined') {
  window.xrStore = xrStore;
}

export default xrStore;
