const assert = require('assert');

// Mock specific time
let currentTime = 0;
const originalDateNow = Date.now;
Date.now = () => currentTime;

// Mock setTimeout/clearTimeout
const timers = new Map();
let timerIdCounter = 1;

global.setTimeout = (callback, delay) => {
  const id = timerIdCounter++;
  const executeAt = currentTime + delay;
  timers.set(id, { callback, executeAt, delay });
  // console.log(`[Timer] Set ${id} for ${delay}ms (target: ${executeAt})`);
  return id;
};

global.clearTimeout = (id) => {
  if (timers.has(id)) {
    // console.log(`[Timer] Clear ${id}`);
    timers.delete(id);
  }
};

// Helper to advance time
async function advanceTime(ms) {
  console.log(`[Time] Advancing ${ms}ms... (Current: ${currentTime} -> ${currentTime + ms})`);
  const endTime = currentTime + ms;
  
  // Find timers that should fire
  while (true) {
    let nextTimer = null;
    let nextTimerId = null;

    for (const [id, timer] of timers.entries()) {
      if (timer.executeAt <= endTime) {
        if (!nextTimer || timer.executeAt < nextTimer.executeAt) {
          nextTimer = timer;
          nextTimerId = id;
        }
      }
    }

    if (!nextTimer) break;

    // Advance to timer execution time
    currentTime = nextTimer.executeAt;
    timers.delete(nextTimerId); // Remove before executing to allow rescheduling
    
    try {
      // console.log(`[Timer] Firing ${nextTimerId}`);
      await nextTimer.callback();
    } catch (e) {
      console.error(`[Timer] Error in callback:`, e);
    }
  }

  // Finally ensure we reach exactly the end time
  currentTime = endTime;
}

// Mock Dependencies
const mockApiGateway = {
  loadedModel: null,
  downloadedModels: new Set(['small']),
  
  async loadModel(key) {
    console.log(`[MockAPI] Loading model: ${key}`);
    this.loadedModel = key;
    this.downloadedModels.add(key); // Implicit download
    return { success: true };
  },
  
  async unloadModel() {
    console.log(`[MockAPI] Unloading model`);
    this.loadedModel = null;
    return { success: true };
  },

  async getLoadedModel() {
    return { current_model: this.loadedModel };
  },
  
  async deleteModel(key) {
      console.log(`[MockAPI] Deleting model: ${key}`);
      this.downloadedModels.delete(key);
      if (this.loadedModel === key) this.loadedModel = null;
  }
};

const mockPool = {
    async query(sql, params) {
        // Mock DB: Check if model exists
        if (sql.includes('SELECT') && sql.includes('ai_models')) {
            const key = params[0];
            // Simulate 'small' and 'base' existing in DB
            if (['small', 'base'].includes(key)) {
                return { rows: [{ model_key: key }] };
            }
             return { rows: [] };
        }
         return { rows: [] };
    }
};


// To properly TDD, I'll try to require the real file. If it fails, I'll catch it and explain.
let ModelManager;
class ModelManagerStub {
  constructor(apiGateway, pool) {
      this.apiGateway = apiGateway;
      this.pool = pool;
  }
  async ensureModelLoaded(key, trigger) {}
  async registerActivity(trigger) {}
  async unloadModel() {}
}

try {
   ModelManager = require('./src/services/modelManager');
} catch (e) {
   console.log("ModelManager load failed:", e);
   console.log("ModelManager not found, using stub for initial test verification");
   ModelManager = ModelManagerStub;
}

// --- TESTS ---

async function runTests() {
  console.log('--- Starting ModelManager Tests ---');
  
  const manager = new ModelManager(mockApiGateway, mockPool);
  
  // Test 1: Manual Load & Timeout (10m)
  console.log('\nTest 1: Manual Load & Timeout');
  currentTime = 0;
  await manager.ensureModelLoaded('small', 'manual');
  assert.strictEqual(mockApiGateway.loadedModel, 'small', 'Model should be loaded');
  
  await advanceTime(9 * 60 * 1000); // 9 mins
  assert.strictEqual(mockApiGateway.loadedModel, 'small', 'Model should still be loaded after 9m');
  
  await advanceTime(2 * 60 * 1000); // +2 mins = 11 mins
  assert.strictEqual(mockApiGateway.loadedModel, null, 'Model should be unloaded after 10m manual timeout');
  console.log('✅ Test 1 Passed');

  // Test 2: Auto Load & Timeout (30m)
  console.log('\nTest 2: Auto Load & Timeout');
  currentTime = 0;
  await manager.ensureModelLoaded('small', 'auto');
  assert.strictEqual(mockApiGateway.loadedModel, 'small');
  
  await advanceTime(15 * 60 * 1000);
  assert.strictEqual(mockApiGateway.loadedModel, 'small');
  
  await advanceTime(16 * 60 * 1000); // 31 mins total
  assert.strictEqual(mockApiGateway.loadedModel, null, 'Model should be unloaded after 30m auto timeout');
  console.log('✅ Test 2 Passed');

  // Test 3: Sliding Window (Activity Extension)
  console.log('\nTest 3: Sliding Window');
  currentTime = 0;
  await manager.ensureModelLoaded('small', 'manual'); // Sets 10m timer
  
  await advanceTime(5 * 60 * 1000); // 5m passed, 5m remaining
  
  // Activity happens
  await manager.registerActivity('manual'); // Should reset to +10m from NOW
  
  await advanceTime(6 * 60 * 1000); // Total 11m from start, but only 6m from activity
  assert.strictEqual(mockApiGateway.loadedModel, 'small', 'Model should stay loaded due to activity');
  
  await advanceTime(5 * 60 * 1000); // +5m = 11m from activity
  assert.strictEqual(mockApiGateway.loadedModel, null, 'Model should unload 10m after LAST activity');
  console.log('✅ Test 3 Passed');

  // Test 4: Trigger Upgrade (Auto -> Manual)
  console.log('\nTest 4: Trigger Upgrade (Auto -> Manual)');
  currentTime = 0;
  await manager.ensureModelLoaded('small', 'auto'); // Sets 30m timer
  
  await advanceTime(5 * 60 * 1000);
  
  // User manually interacts (upgrades to manual trigger)
  await manager.registerActivity('manual'); 
  
  await advanceTime(11 * 60 * 1000); // 11m after manual trigger
  assert.strictEqual(mockApiGateway.loadedModel, null, 'Should timeout 10m after switching to manual trigger');
  console.log('✅ Test 4 Passed');

}

runTests().catch(e => {
  console.error('❌ Tests Failed:', e);
  process.exit(1);
});
