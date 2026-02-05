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

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
