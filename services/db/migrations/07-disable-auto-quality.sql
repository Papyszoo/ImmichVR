-- ImmichVR Database Migration: Disable Auto Quality
-- Adds disable_auto_quality column to user_settings

-- ============================================================================
-- 1. ADD COLUMN TO USER_SETTINGS
-- ============================================================================

ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS disable_auto_quality BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- 2. UPDATE COMMENTS
-- ============================================================================

COMMENT ON COLUMN user_settings.disable_auto_quality IS 'If true, prevents automatic quality reduction (LOD) regardless of performance';
