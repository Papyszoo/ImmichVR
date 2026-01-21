const socketIo = require('socket.io');

class SocketManager {
  constructor(server, modelManager) {
    this.io = socketIo(server, {
      cors: {
        origin: "*", // Allow all origins for now (adjust for prod)
        methods: ["GET", "POST"]
      }
    });

    this.modelManager = modelManager;
    this.setupSocketEvents();
    this.setupModelManagerEvents();
  }

  setupSocketEvents() {
    this.io.on('connection', (socket) => {
      console.log(`[Socket] Client connected: ${socket.id}`);

      // Send initial state
      this.sendCurrentState(socket);

      // --- Model Events Recieved from Client ---

      // 1. Load Model
      socket.on('model:load', async (data) => {
        const { modelKey, trigger = 'manual', options = {} } = data;
        console.log(`[Socket] Request load: ${modelKey}`);
        try {
          await this.modelManager.ensureModelLoaded(modelKey, trigger, options);
          // Success is broadcasted via modelManager event listener
        } catch (error) {
          socket.emit('model:error', { message: error.message });
        }
      });

      // 2. Unload Model
      socket.on('model:unload', async () => {
        console.log(`[Socket] Request unload`);
        try {
          await this.modelManager.unloadModel();
        } catch (error) {
          socket.emit('model:error', { message: error.message });
        }
      });

      // 3. Download Model
      socket.on('model:download', async (data) => {
        const { modelKey } = data;
        console.log(`[Socket] Request download: ${modelKey}`);
        try {
          // ModelManager will handle the call and emit status events
          await this.modelManager.downloadModel(modelKey);
        } catch (error) {
          socket.emit('model:error', { message: error.message });
        }
      });

      socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
      });
    });
  }

  setupModelManagerEvents() {
    if (!this.modelManager) return;

    // Listen to internal ModelManager events and broadcast to all clients

    this.modelManager.on('model:status', (payload) => {
      // payload: { status, modelKey, loadedAt, etc. }
      this.io.emit('model:status', payload);
    });

    this.modelManager.on('model:download-progress', (payload) => {
      this.io.emit('model:download-progress', payload);
    });
    
    this.modelManager.on('error', (payload) => {
        this.io.emit('model:error', payload);
    });
  }

  async sendCurrentState(socket) {
    // Send what is currently happening
    if (this.modelManager.currentModel) {
      socket.emit('model:status', {
        status: 'loaded',
        modelKey: this.modelManager.currentModel,
        loadedAt: this.modelManager.loadedAt
      });
    } else {
        socket.emit('model:status', { status: 'unloaded', modelKey: null });
    }
  }
}

module.exports = SocketManager;
