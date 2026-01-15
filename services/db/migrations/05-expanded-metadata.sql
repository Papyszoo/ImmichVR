-- ImmichVR Database Migration: Expanded AI Model Metadata
-- Adds display name, parameters, memory usage, and description to ai_models table

-- 1. Add new columns
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS name VARCHAR(100);
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS params VARCHAR(50);
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS memory VARCHAR(50);
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS huggingface_id VARCHAR(100);

-- 2. Update existing rows with metadata
UPDATE ai_models SET
    name = 'Small',
    params = '25M',
    memory = '~100MB',
    description = 'Fastest, lower quality. Good for quick previews.',
    huggingface_id = 'depth-anything/Depth-Anything-V2-Small-hf'
WHERE model_key = 'small';

UPDATE ai_models SET
    name = 'Base',
    params = '97M',
    memory = '~400MB',
    description = 'Balanced speed and quality. Recommended for most users.',
    huggingface_id = 'depth-anything/Depth-Anything-V2-Base-hf'
WHERE model_key = 'base';

UPDATE ai_models SET
    name = 'Large',
    params = '335M',
    memory = '~1.3GB',
    description = 'Highest quality, slowest generation. Requires more VRAM.',
    huggingface_id = 'depth-anything/Depth-Anything-V2-Large-hf'
WHERE model_key = 'large';

-- 3. Ensure constraints
ALTER TABLE ai_models ALTER COLUMN name SET DEFAULT '';
-- (Optional) Add NOT NULL constraints if we want to enforce it later, 
-- but usually safer to leave nullable during migration unless we are sure.
