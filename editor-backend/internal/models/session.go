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

	// Phase 2: Repurposer integration fields
	SourceAssetID   string `json:"source_asset_id,omitempty"`
	SourceJobID     string `json:"source_job_id,omitempty"`
	SourceModule    string `json:"source_module,omitempty"`
	Platform        string `json:"platform,omitempty"`
	ExportedAssetID string `json:"exported_asset_id,omitempty"`
	ExportStatus    string `json:"export_status,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
