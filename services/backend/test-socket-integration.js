const io = require('socket.io-client');
const assert = require('assert');

const SOCKET_URL = 'https://localhost:21370';

const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  forceNew: true,
  rejectUnauthorized: false // For self-signed certs in dev
});

console.log('Connecting to socket...');

socket.on('connect', () => {
  console.log('Connected to backend!');
  
  // Wait a bit to receive initial status
  setTimeout(() => {
     console.log('Testing model download...');
     // Note: using 'small' as a test model key, assuming it exists or handled
     socket.emit('model:download', { modelKey: 'small' });
  }, 1000);
});

let state = 'init';

socket.on('model:status', (data) => {
  console.log(`[Received Status] State: ${state}, Data:`, data);
  
  // Initial state might be unloaded
  if (state === 'init') {
      // Start flow
      console.log('Initial state received. Starting flow: Testing model download...');
      state = 'downloading';
      socket.emit('model:download', { modelKey: 'small' });
      return;
  }

  if (state === 'downloading' && data.status === 'downloaded' && data.modelKey === 'small') {
      console.log('Download complete. Testing load...');
      state = 'loading';
      socket.emit('model:load', { modelKey: 'small' });
  }

  if (state === 'loading' && data.status === 'loaded' && data.modelKey === 'small') {
      console.log('Load complete. Testing unload...');
      state = 'unloading';
      socket.emit('model:unload');
  }

  if (state === 'unloading' && data.status === 'unloaded') {
      console.log('Unload complete. Verification PASSED.');
      socket.disconnect();
      process.exit(0);
  }
  
  if (data.status === 'error') {
      console.error('Test Failed:', data.message);
      // We don't exit generic error immediately, might be expected in some flows, but for happy path ensuring success
      if (data.message.includes('not downloaded')) {
          // Expected if clean db, but we triggered download first.
      }
  }
});

socket.on('connect_error', (err) => {
    console.error('Connection Error:', err.message);
    process.exit(1);
});

// Timeout
setTimeout(() => {
    console.error('Test Timeout');
    process.exit(1);
}, 30000);
