import { createXRStore, DefaultXRController } from '@react-three/xr';
import { SteamVRInputAdapter } from './SteamVRInputAdapter';

// Create XR store for managing VR sessions with default controllers/hands
const xrStore = createXRStore({
  controller: DefaultXRController,
  hand: SteamVRInputAdapter,
});

// Export store for external access
if (typeof window !== 'undefined') {
  window.xrStore = xrStore;
}

export default xrStore;
