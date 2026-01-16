const pool = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

/**
 * Initializes the database schema updates for AI models.
 * This function should be called on application startup.
 */
async function ensureSchema() {
  console.log('Checking database schema status...');
  
  const client = await pool.connect();
  
  try {
    // 1. Check if 'name' column exists in 'ai_models'
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='ai_models' AND column_name='name'
    `);
    
    if (res.rows.length === 0) {
      console.log('Applying migration: Expanded AI Model Metadata...');
      
      await client.query('BEGIN');
      
      // 0. Ensure tables exist (in case 04-model-management.sql didn't run)
      await client.query(`
        CREATE TABLE IF NOT EXISTS ai_models (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            model_key VARCHAR(50) NOT NULL UNIQUE,
            status VARCHAR(20) NOT NULL DEFAULT 'not_downloaded',
            download_progress INTEGER DEFAULT 0,
            file_size_bytes BIGINT,
            downloaded_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_settings (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID,
            default_depth_model VARCHAR(50) NOT NULL DEFAULT 'small',
            auto_generate_on_enter BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT user_settings_user_unique UNIQUE (user_id)
        )
      `);
      
      // 0.5. Check for depth_map_cache model_key
      const depthCacheCols = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='depth_map_cache' AND column_name='model_key'
      `);
      
      if (depthCacheCols.rows.length === 0) {
        console.log('Applying migration: Multi-Model Support for depth_map_cache...');
        
        // Add model_key column
        await client.query(`ALTER TABLE depth_map_cache ADD COLUMN IF NOT EXISTS model_key VARCHAR(50) DEFAULT 'large'`);
        
        // Drop old constraint
        await client.query(`ALTER TABLE depth_map_cache DROP CONSTRAINT IF EXISTS depth_map_cache_media_item_version_unique`);
        
        // Add new constraint
        await client.query(`
          ALTER TABLE depth_map_cache 
          ADD CONSTRAINT depth_map_cache_media_version_model_unique 
          UNIQUE (media_item_id, version_type, model_key)
        `);
        
        // Add index
        await client.query(`CREATE INDEX IF NOT EXISTS idx_depth_map_cache_model_key ON depth_map_cache(model_key)`);
      }

      // Add columns
      await client.query(`ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS name VARCHAR(100)`);
      await client.query(`ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS params VARCHAR(50)`);
      await client.query(`ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS memory VARCHAR(50)`);
      await client.query(`ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS description TEXT`);
      await client.query(`ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS huggingface_id VARCHAR(100)`);
      
      // Populate Data
      const models = [
        {
          key: 'small',
          name: 'Small',
          params: '25M',
          memory: '~100MB',
          description: 'Fastest, lower quality. Good for quick previews.',
          huggingface_id: 'depth-anything/Depth-Anything-V2-Small-hf'
        },
        {
          key: 'base',
          name: 'Base',
          params: '97M',
          memory: '~400MB',
          description: 'Balanced speed and quality. Recommended for most users.',
          huggingface_id: 'depth-anything/Depth-Anything-V2-Base-hf'
        },
        {
          key: 'large',
          name: 'Large',
          params: '335M',
          memory: '~1.3GB',
          description: 'Highest quality, slowest generation. Requires more VRAM.',
          huggingface_id: 'depth-anything/Depth-Anything-V2-Large-hf'
        }
      ];
      
      for (const m of models) {
        // First try update
        const updateRes = await client.query(`
          UPDATE ai_models SET
            name = $1,
            params = $2,
            memory = $3,
            description = $4,
            huggingface_id = $5
          WHERE model_key = $6
        `, [m.name, m.params, m.memory, m.description, m.huggingface_id, m.key]);
        
        // If no rows updated (and key didn't exist), insert it
        if (updateRes.rowCount === 0) {
           await client.query(`
            INSERT INTO ai_models (model_key, status, name, params, memory, description, huggingface_id)
            VALUES ($1, 'not_downloaded', $2, $3, $4, $5, $6)
          `, [m.key, m.name, m.params, m.memory, m.description, m.huggingface_id]);
        }
      }
      
      // Check/create trigger function if missing? (Skipping for simplicity, assuming basic function exists or defaults work)
      // Ideally we'd add update_updated_at_column trigger here too but it might be complex if function missing.
      
      await client.query('COMMIT');
      console.log('Migration applied successfully.');
    } else {
      console.log('Database schema is up to date.');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to initialize database schema:', error);
  } finally {
    client.release();
  }
}

module.exports = {
  ensureSchema
};
