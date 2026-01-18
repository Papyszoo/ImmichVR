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
      await client.query(`ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'depth'`);
      
      // Populate Data
      const models = [
        {
          key: 'small',
          name: 'Small',
          type: 'depth',
          params: '25M',
          memory: '~100MB',
          description: 'Fastest, lower quality. Good for quick previews.',
          huggingface_id: 'depth-anything/Depth-Anything-V2-Small-hf'
        },
        {
          key: 'base',
          name: 'Base',
          type: 'depth',
          params: '97M',
          memory: '~400MB',
          description: 'Balanced speed and quality. Recommended for most users.',
          huggingface_id: 'depth-anything/Depth-Anything-V2-Base-hf'
        },
        {
          key: 'large',
          name: 'Large',
          type: 'depth',
          params: '335M',
          memory: '~1.3GB',
          description: 'Highest quality, slowest generation. Requires more VRAM.',
          huggingface_id: 'depth-anything/Depth-Anything-V2-Large-hf'
        },
        {
          key: 'sharp',
          name: 'SHARP',
          type: 'splat',
          params: '~2GB',
          memory: '~4GB RAM',
          description: 'Apple ml-sharp: Photorealistic 3D from single image. Outputs Gaussian Splat.',
          huggingface_id: 'apple/ml-sharp'
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
            huggingface_id = $5,
            type = $6
          WHERE model_key = $7
        `, [m.name, m.params, m.memory, m.description, m.huggingface_id, m.type || 'depth', m.key]);
        
        // If no rows updated (and key didn't exist), insert it
        if (updateRes.rowCount === 0) {
           await client.query(`
            INSERT INTO ai_models (model_key, status, name, params, memory, description, huggingface_id, type)
            VALUES ($1, 'not_downloaded', $2, $3, $4, $5, $6, $7)
          `, [m.key, m.name, m.params, m.memory, m.description, m.huggingface_id, m.type || 'depth']);
        }
      }
      
      // Check/create trigger function if missing? (Skipping for simplicity, assuming basic function exists or defaults work)
      // Check/create trigger function if missing? (Skipping for simplicity, assuming basic function exists or defaults work)
      
      await client.query('COMMIT');
      console.log('Base migration applied successfully.');
    } else {
      console.log('Base database schema is up to date (ai_models.name exists).');
    }

    // ============================================================================
    // MIGRATION: Generic 3D Assets (Phase 1.1)
    // ============================================================================
    const genAssetsTable = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name='generated_assets_3d'
      `);
      
    if (genAssetsTable.rows.length === 0) {
      console.log('Applying migration: Generic 3D Assets (Replacing depth_map_cache)...');
      
      await client.query('BEGIN');

        // 1. Drop old table
        await client.query('DROP TABLE IF EXISTS depth_map_cache CASCADE');
        await client.query('DROP TYPE IF EXISTS depth_map_format CASCADE');
        await client.query('DROP TYPE IF EXISTS depth_map_version CASCADE');

        // 2. Create generated_assets_3d table
        await client.query(`
          CREATE TABLE generated_assets_3d (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              media_item_id UUID NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
              asset_type VARCHAR(20) NOT NULL,
              model_key VARCHAR(50),
              format VARCHAR(20) NOT NULL,
              file_path TEXT NOT NULL,
              file_size BIGINT,
              width INTEGER,
              height INTEGER,
              metadata JSONB DEFAULT '{}',
              generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
              CONSTRAINT unique_asset_version UNIQUE NULLS NOT DISTINCT (media_item_id, asset_type, model_key, format)
          )
        `);

        // Indexes
        await client.query('CREATE INDEX idx_generated_assets_3d_media_item_id ON generated_assets_3d(media_item_id)');
        await client.query('CREATE INDEX idx_generated_assets_3d_asset_type ON generated_assets_3d(asset_type)');
        await client.query('CREATE INDEX idx_generated_assets_3d_model_key ON generated_assets_3d(model_key)');
        await client.query('CREATE INDEX idx_generated_assets_3d_generated_at ON generated_assets_3d(generated_at)');
        await client.query('CREATE INDEX idx_generated_assets_3d_media_type_model ON generated_assets_3d(media_item_id, asset_type, model_key)');

        // 3. Update ai_models table
        await client.query(`ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'depth'`);
        // Rename columns if they exist (handling potential re-run case or partial state)
        // Note: In postgres, renaming if exists is tricky in one line, but ALTER TABLE fails if column missing.
        // We'll assume the previous migration block ran so 'params' and 'memory' exist.
        
        // Check if params_size already exists to avoid error
        const aiModelsCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='ai_models'`);
        const cols = aiModelsCols.rows.map(r => r.column_name);
        
        if (cols.includes('params') && !cols.includes('params_size')) {
             await client.query('ALTER TABLE ai_models RENAME COLUMN params TO params_size');
        }
        if (cols.includes('memory') && !cols.includes('vram_usage')) {
             await client.query('ALTER TABLE ai_models RENAME COLUMN memory TO vram_usage');
        }

        // 4. Update Views
        await client.query('DROP VIEW IF EXISTS media_processing_status CASCADE');
        await client.query(`
          CREATE VIEW media_processing_status AS
          SELECT 
              m.id AS media_id,
              m.original_filename,
              m.media_type,
              m.uploaded_at,
              pq.status AS processing_status,
              pq.attempts AS processing_attempts,
              pq.last_error,
              ga.id AS asset_id,
              ga.asset_type,
              ga.model_key,
              ga.format,
              ga.file_path AS asset_path,
              ga.generated_at AS asset_generated_at
          FROM media_items m
          LEFT JOIN processing_queue pq ON m.id = pq.media_item_id
          LEFT JOIN generated_assets_3d ga ON m.id = ga.media_item_id
        `);
        
        // 5. Trigger
        await client.query(`
            CREATE TRIGGER update_generated_assets_3d_updated_at
            BEFORE UPDATE ON generated_assets_3d
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()
        `);



      
      await client.query('COMMIT');
      console.log('Generic 3D Assets migration applied successfully.');
    } else {
      console.log('Generic 3D Assets schema is up to date.');
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
