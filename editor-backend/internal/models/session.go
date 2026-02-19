// internal/models/session.go
package models

import (
	"time"

	"github.com/google/uuid"
)

type EditorSession struct {
	SessionID uuid.UUID `json:"session_id"`
	UserID    uuid.UUID `json:"user_id"`
	ContentID uuid.UUID `json:"content_id"`

	Timeline map[string]interface{} `json:"timeline"`

	Version int    `json:"version"`
	Status  string `json:"status"`

	// Source context — tracks where this editing session originated
	// Populated when a clip is sent to the editor from Repurposer or Content Hub
	SourceAssetID *uuid.UUID `json:"source_asset_id,omitempty"`  // Content Hub asset being edited
	SourceJobID   string     `json:"source_job_id,omitempty"`    // Repurposer job ID (e.g. "job_1737423456_1234")
	SourceModule  string     `json:"source_module,omitempty"`    // "repurposer" | "content_hub" | "stv"
	Platform      string     `json:"platform,omitempty"`         // "tiktok" | "ig_reels" | "youtube_shorts" | "linkedin"

	// Export tracking — what happened after editing (Phase 2)
	ExportedAssetID *uuid.UUID `json:"exported_asset_id,omitempty"` // Content Hub asset created by export
	ExportStatus    string     `json:"export_status,omitempty"`     // "" | "rendering" | "uploading" | "completed" | "failed"

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
