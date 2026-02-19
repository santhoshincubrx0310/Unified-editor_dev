-- ============================================================================
-- UNIFIED EDITOR - Integration Migration
-- Adds source context and export tracking to editor_sessions
-- ============================================================================
-- Run on: incubrix PostgreSQL (same DB as all services)
-- Date: February 2026
-- Purpose: Enable Repurposer → Editor → Content Hub flow
--
-- SAFE TO RUN MULTIPLE TIMES (all statements use IF NOT EXISTS)
-- ============================================================================

-- ============================================================================
-- SOURCE CONTEXT: Where did this editing session come from?
-- ============================================================================

-- The Content Hub asset being edited (e.g., a repurposed clip)
ALTER TABLE editor_sessions
    ADD COLUMN IF NOT EXISTS source_asset_id UUID;

-- The job that created the source asset (e.g., "job_1737423456_1234")
ALTER TABLE editor_sessions
    ADD COLUMN IF NOT EXISTS source_job_id TEXT DEFAULT '';

-- Which module initiated the edit: "repurposer" | "content_hub" | "stv"
ALTER TABLE editor_sessions
    ADD COLUMN IF NOT EXISTS source_module VARCHAR(50) DEFAULT '';

-- Platform context for repurposed clips: "tiktok" | "ig_reels" | "youtube_shorts" | "linkedin"
ALTER TABLE editor_sessions
    ADD COLUMN IF NOT EXISTS platform VARCHAR(50) DEFAULT '';

-- ============================================================================
-- EXPORT TRACKING: What was produced after editing?
-- ============================================================================

-- The Content Hub asset created when user exports from editor
ALTER TABLE editor_sessions
    ADD COLUMN IF NOT EXISTS exported_asset_id UUID;

-- Export pipeline status: "" | "rendering" | "uploading" | "completed" | "failed"
ALTER TABLE editor_sessions
    ADD COLUMN IF NOT EXISTS export_status VARCHAR(50) DEFAULT '';

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Find sessions by the asset being edited (reuse session when user clicks Edit again)
CREATE INDEX IF NOT EXISTS idx_editor_sessions_source_asset
    ON editor_sessions(source_asset_id) WHERE source_asset_id IS NOT NULL;

-- Find sessions by originating module (analytics, cleanup)
CREATE INDEX IF NOT EXISTS idx_editor_sessions_source_module
    ON editor_sessions(user_id, source_module) WHERE source_module != '';

-- Find sessions by export status (monitor rendering pipeline)
CREATE INDEX IF NOT EXISTS idx_editor_sessions_export_status
    ON editor_sessions(user_id, export_status) WHERE export_status != '';

-- ============================================================================
-- NOTES
-- ============================================================================
-- • No FK constraints to assets table — the editor service stays decoupled
--   from Content Hub schema. The consuming service (Repurposer/CMS) is
--   responsible for passing valid asset IDs.
-- • source_asset_id is used as content_id when creating sessions from clips,
--   enabling FindOrCreateSession to reuse sessions (no orphan rows).
-- • exported_asset_id + export_status will be populated by Phase 2 (Export flow).
-- ============================================================================
