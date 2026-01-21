import { io } from 'socket.io-client';

// Singleton socket instance
let socket = null;
const API_URL = import.meta.env.VITE_API_URL || '/'; 
// Note: In docker/prod, this might need to point to window.location or configured URL

export const getSocket = () => {
  if (!socket) {
    console.log(`[Socket] Connecting to ${API_URL}`);
    socket = io(API_URL, {
      transports: ['websocket'],
      upgrade: false,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
    });

    socket.on('connect_error', (err) => {
        console.error('[Socket] Connection error:', err);
    });
  }
  return socket;
};

// Typed Wrappers for Model Events

export const modelSocket = {
  load: (modelKey, trigger = 'manual', options = {}) => {
    getSocket().emit('model:load', { modelKey, trigger, options });
  },

  unload: () => {
    getSocket().emit('model:unload');
  },

  download: (modelKey) => {
      getSocket().emit('model:download', { modelKey });
  },

  generate: (id, type, modelKey) => {
      getSocket().emit('model:generate', { id, type, modelKey });
  },

  onStatusChange: (callback) => {
    getSocket().on('model:status', callback);
    return () => getSocket().off('model:status', callback);
  },
  
  onError: (callback) => {
      getSocket().on('model:error', callback);
      return () => getSocket().off('model:error', callback);
  },

  onGenerationProgress: (callback) => {
      getSocket().on('model:generation-progress', callback);
      return () => getSocket().off('model:generation-progress', callback);
  },

  onGenerationComplete: (callback) => {
      getSocket().on('model:generation-complete', callback);
      return () => getSocket().off('model:generation-complete', callback);
  }
};
