class ModelManager {
  constructor(apiGateway, dbPool) {
    this.apiGateway = apiGateway;
    
    // Lazy load default pool if not provided (allows testing without pg)
    if (dbPool) {
      this.pool = dbPool;
    } else {
      this.pool = require('../config/database');
    }

    this.currentModel = null;
    this.loadedAt = null;
    this.lastUsedAt = null;
    this.loadTrigger = null; // 'auto' | 'manual'
    this.timeoutHandle = null;
    
    // Timeout configurations (in milliseconds)
    // Support Env Vars for testing (e.g. set to 2000 for 2s timeout)
    this.TIMEOUTS = {
      'auto': parseInt(process.env.MODEL_TIMEOUT_AUTO) || 30 * 60 * 1000,   // Default 30 minutes
      'manual': parseInt(process.env.MODEL_TIMEOUT_MANUAL) || 10 * 60 * 1000  // Default 10 minutes
    };

    // Initial sync with AI service (to catch up existing downloads)
    this.syncModelsWithService().catch(err => console.error('[ModelManager] Failed to sync models on init:', err));
  }

  /**
   * Sync database status with actual disk state from AI service
   * This ensures the DB accurately reflects what models are actually downloaded
   */
  async syncModelsWithService() {
    try {
      console.log('[ModelManager] Syncing model status with AI service...');
      const response = await this.apiGateway.proxyToAIService('/api/models');
      
      if (response && response.data && response.data.models) {
        for (const model of response.data.models) {
          if (model.is_downloaded) {
             // If service says downloaded, ensure DB agrees
             await this.pool.query(
               `UPDATE ai_models SET status = 'downloaded', downloaded_at = COALESCE(downloaded_at, NOW()) 
                WHERE model_key = $1 AND status != 'downloaded'`,
               [model.key]
             );
          } else {
             // If service says NOT downloaded, update DB to match reality
             // This handles the case where DB was seeded with 'downloaded' but cache is empty
             await this.pool.query(
               `UPDATE ai_models SET status = 'not_downloaded', downloaded_at = NULL 
                WHERE model_key = $1 AND status = 'downloaded'`,
               [model.key]
             );
          }
        }
        console.log('[ModelManager] Model sync complete.');
      }
    } catch (error) {
       // Silent fail is okay on init (service might be starting up), 
       // but we should log it.
       console.warn('[ModelManager] Could not sync with AI service (might be starting up):', error.message);
    }
  }

  /**
   * Validate if a model key exists in the database
   */
  async validateModelKey(key) {
    try {
      const result = await this.pool.query(
        'SELECT model_key FROM ai_models WHERE model_key = $1',
        [key]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('Model validation failed:', error);
      return false;
    }
  }

  /**
   * Ensure a specific model is loaded
   * @param {string} modelKey - Key of the model to load
   * @param {string} trigger - 'auto' or 'manual'
   * @param {Object} options - { device: 'auto'|'cpu'|'gpu' }
   */
  async ensureModelLoaded(modelKey, trigger = 'auto', options = {}) {
    // 1. Validate Model & Check Status
    const modelResult = await this.pool.query(
      'SELECT status FROM ai_models WHERE model_key = $1',
      [modelKey]
    );

    if (modelResult.rows.length === 0) {
      throw new Error(`Invalid model key: ${modelKey}`);
    }

    const dbStatus = modelResult.rows[0].status;

    // 1b. Check download status (Strict: Fail if not downloaded)
    if (dbStatus !== 'downloaded') {
       throw new Error(`Model ${modelKey} is not downloaded (Status: ${dbStatus}). Please download it first.`);
    }

    // 2. Check if already loaded
    // If specific device requested, we must pass through to AI service to handle potential switch
    if (this.currentModel === modelKey && !options?.device) {
      // Just register activity to extend timeout
      await this.registerActivity(trigger);
      return;
    }

    // 3. Load via API Gateway
    console.log(`[ModelManager] Loading model ${modelKey} (Trigger: ${trigger}, Device: ${options?.device || 'default'})`);
    try {
      await this.apiGateway.loadModel(modelKey, options);
      
      this.currentModel = modelKey;
      this.loadedAt = Date.now();
      
      // 4. Set initial activity/timeout
      await this.registerActivity(trigger);
      
    } catch (error) {
      console.error(`[ModelManager] Failed to load model ${modelKey}:`, error);
      throw error;
    }
  }

  /**
   * Register activity to reset/update the timeout
   * @param {string} trigger - 'auto' or 'manual'
   */
  async registerActivity(trigger) {
    if (!this.currentModel) return;

    this.lastUsedAt = Date.now();
    
    // Update trigger mechanism logic:
    // If current is 'auto' and new is 'manual', upgrade to 'manual' (shorter timeout but higher priority intent? or just user preference?)
    // Requirements: 
    // - "default model stays active for 30 minutes from last finished job" (Auto)
    // - "on demand - we load model and it stays active 10 minutes" (Manual)
    // - Interpretation: We respect the duration of the *latest* valid trigger.
    
    this.loadTrigger = trigger;
    this.resetTimeout();
  }

  /**
   * Internal/Public: Unload the current model
   * @param {string} specificKey - Optional key to ensure we only unload if this is the active model
   */
  async unloadModel(specificKey = null) {
    // If specific key provided, trust it and pass to gateway regardless of local state
    // This fixes issues where Backend restarts (currentModel=null) but AI Service has model loaded (Zombie State)
    const target = specificKey || this.currentModel;
    
    if (!target) {
        // Nothing to unload
        return;
    }

    console.log(`[ModelManager] Unloading model ${target}`);
    try {
      // We pass the key to the AI service just to be safe/explicit, though AI service might just unload whatever is there.
      await this.apiGateway.unloadModel(target);
    } catch (error) {
      console.error('[ModelManager] Failed to unload model:', error);
    } finally {
      // Only clear local state if it matched
      if (this.currentModel === target) {
          this.currentModel = null;
          this.loadTrigger = null;
          this.clearTimeout();
      }
    }
  }

  /**
   * Internal: Reset the timeout timer based on current trigger and last used time
   */
  resetTimeout() {
    this.clearTimeout();

    const duration = this.TIMEOUTS[this.loadTrigger] || this.TIMEOUTS['auto'];
    
    // Calculate remaining time if we want exact precision, 
    // but typically we just set a fresh timer for 'duration' from NOW 
    // because `registerActivity` just happened NOW.
    
    this.timeoutHandle = setTimeout(() => {
      this.unloadModel();
    }, duration);
    
    // console.log(`[ModelManager] Timeout set for ${duration/1000/60} minutes`);
  }

  /**
   * Internal: Clear existing timeout
   */
  clearTimeout() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  /**
   * TEST ONLY: Update timeouts at runtime
   */
  setTimeouts(autoMs, manualMs) {
      if (autoMs) this.TIMEOUTS['auto'] = autoMs;
      if (manualMs) this.TIMEOUTS['manual'] = manualMs;
      console.log('[ModelManager] Timeouts updated for testing:', this.TIMEOUTS);
  }
}

module.exports = ModelManager;
