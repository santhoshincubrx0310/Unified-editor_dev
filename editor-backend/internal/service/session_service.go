// internal/service/session_service.go
package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"editor-backend/internal/models"

	"github.com/google/uuid"
)

// Sentinel errors — callers use errors.Is() instead of string matching
var (
	ErrSessionNotFound = errors.New("session not found")
	ErrUnauthorized    = errors.New("unauthorized: session belongs to another user")
)

type SessionService struct {
	DB *sql.DB
}

// ============================================================================
// FULL COLUMN LIST — used by all SELECT queries
// ============================================================================
// Centralised here so adding a column means updating ONE place.

const sessionSelectColumns = `
	session_id, user_id, content_id, timeline, version, status,
	source_asset_id, source_job_id, source_module, platform,
	exported_asset_id, export_status,
	created_at, updated_at
`

// scanSession maps a row into an EditorSession. Every SELECT that returns
// sessionSelectColumns must use this helper — keeps scan order in sync.
func scanSession(scanner interface{ Scan(dest ...interface{}) error }) (*models.EditorSession, error) {
	session := &models.EditorSession{}
	var timelineJSON []byte
	var sourceJobID, sourceModule, platform sql.NullString
	var exportStatus sql.NullString

	err := scanner.Scan(
		&session.SessionID,
		&session.UserID,
		&session.ContentID,
		&timelineJSON,
		&session.Version,
		&session.Status,
		&session.SourceAssetID,
		&sourceJobID,
		&sourceModule,
		&platform,
		&session.ExportedAssetID,
		&exportStatus,
		&session.CreatedAt,
		&session.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if sourceJobID.Valid {
		session.SourceJobID = sourceJobID.String
	}
	if sourceModule.Valid {
		session.SourceModule = sourceModule.String
	}
	if platform.Valid {
		session.Platform = platform.String
	}
	if exportStatus.Valid {
		session.ExportStatus = exportStatus.String
	}

	if len(timelineJSON) > 0 {
		json.Unmarshal(timelineJSON, &session.Timeline)
	}

	return session, nil
}

// ============================================================================
// FIND OR CREATE — Original (untouched contract, updated internals)
// ============================================================================

// FindOrCreateSession is the KEY fix for the 164-orphaned-rows problem.
//
// Old behaviour:  Every page load → INSERT → new orphan row
// New behaviour:  Every page load → SELECT first → only INSERT if nothing found
//
// This means:
//   - User opens editor → fresh session created
//   - User refreshes → SAME session returned, work is not lost
//   - User opens on another device → SAME session returned
//   - No more accumulating trash rows in your DB
func (s *SessionService) FindOrCreateSession(userID, contentID uuid.UUID) (*models.EditorSession, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Step 1: Look for an existing active session for this user + content
	existing, err := s.findExistingSession(ctx, userID, contentID)
	if err == nil {
		// Found one — return it, do not create a new row
		return existing, nil
	}
	if !errors.Is(err, ErrSessionNotFound) {
		// Unexpected DB error
		return nil, err
	}

	// Step 2: No existing session found — create a new one
	return s.createSession(ctx, userID, contentID)
}

// ============================================================================
// FIND OR CREATE WITH SOURCE — NEW (for Repurposer / Content Hub integration)
// ============================================================================

// FindOrCreateSessionWithSource creates an editing session with full source
// context (which asset, which job, which module, which platform). If a session
// already exists for this user + contentID, it is returned instead.
//
// When source_asset_id is provided by the caller, it should be passed as
// contentID — this enables the "click Edit twice on same clip → same session"
// behaviour via findExistingSession.
func (s *SessionService) FindOrCreateSessionWithSource(
	userID, contentID uuid.UUID,
	sourceAssetID, sourceJobID, sourceModule, platform string,
) (*models.EditorSession, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Step 1: Reuse existing session (same logic as FindOrCreateSession)
	existing, err := s.findExistingSession(ctx, userID, contentID)
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, ErrSessionNotFound) {
		return nil, err
	}

	// Step 2: Create new session WITH source context
	return s.createSessionWithSource(ctx, userID, contentID,
		sourceAssetID, sourceJobID, sourceModule, platform)
}

// ============================================================================
// INTERNAL — FIND
// ============================================================================

func (s *SessionService) findExistingSession(ctx context.Context, userID, contentID uuid.UUID) (*models.EditorSession, error) {
	query := `
		SELECT ` + sessionSelectColumns + `
		FROM editor_sessions
		WHERE user_id = $1 AND content_id = $2
		ORDER BY created_at DESC
		LIMIT 1
	`

	row := s.DB.QueryRowContext(ctx, query, userID, contentID)
	session, err := scanSession(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrSessionNotFound
	}
	return session, err
}

// ============================================================================
// INTERNAL — CREATE (original, no source context)
// ============================================================================

func (s *SessionService) createSession(ctx context.Context, userID, contentID uuid.UUID) (*models.EditorSession, error) {
	query := `
		INSERT INTO editor_sessions (user_id, content_id)
		VALUES ($1, $2)
		RETURNING ` + sessionSelectColumns

	row := s.DB.QueryRowContext(ctx, query, userID, contentID)
	session, err := scanSession(row)
	if err != nil {
		return nil, err
	}

	session.UserID = userID
	session.ContentID = contentID
	return session, nil
}

// ============================================================================
// INTERNAL — CREATE WITH SOURCE (new, for clip editing)
// ============================================================================

func (s *SessionService) createSessionWithSource(
	ctx context.Context, userID, contentID uuid.UUID,
	sourceAssetID, sourceJobID, sourceModule, platform string,
) (*models.EditorSession, error) {

	// Parse source_asset_id if provided
	var srcAssetUUID *uuid.UUID
	if sourceAssetID != "" {
		parsed, err := uuid.Parse(sourceAssetID)
		if err == nil {
			srcAssetUUID = &parsed
		}
	}

	query := `
		INSERT INTO editor_sessions (
			user_id, content_id,
			source_asset_id, source_job_id, source_module, platform
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING ` + sessionSelectColumns

	row := s.DB.QueryRowContext(ctx, query,
		userID, contentID,
		srcAssetUUID, sourceJobID, sourceModule, platform,
	)

	session, err := scanSession(row)
	if err != nil {
		return nil, err
	}

	session.UserID = userID
	session.ContentID = contentID
	return session, nil
}

// ============================================================================
// GET SESSION — Updated to scan new columns
// ============================================================================

// GetSession fetches a session and verifies ownership.
// Passing userID ensures one user cannot read another user's session.
// When gateway is wired up, this is the enforcement layer.
func (s *SessionService) GetSession(id, userID uuid.UUID) (*models.EditorSession, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		SELECT ` + sessionSelectColumns + `
		FROM editor_sessions
		WHERE session_id = $1
	`

	row := s.DB.QueryRowContext(ctx, query, id)
	session, err := scanSession(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrSessionNotFound
	}
	if err != nil {
		return nil, err
	}

	// Ownership check — session must belong to the requesting user
	if session.UserID != userID {
		return nil, ErrUnauthorized
	}

	return session, nil
}

// ============================================================================
// SAVE SESSION — Unchanged logic, same as before
// ============================================================================

// SaveSession persists timeline JSON and bumps the version counter.
// version acts as a basic audit trail — you can see how many times a session was saved.
func (s *SessionService) SaveSession(id uuid.UUID, timeline map[string]interface{}) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	timelineJSON, err := json.Marshal(timeline)
	if err != nil {
		return err
	}

	query := `
		UPDATE editor_sessions
		SET timeline   = $1,
		    version    = version + 1,
		    updated_at = NOW()
		WHERE session_id = $2
	`

	result, err := s.DB.ExecContext(ctx, query, timelineJSON, id)
	if err != nil {
		return err
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrSessionNotFound
	}

	return nil
}

// ============================================================================
// DELETE SESSION — Unchanged
// ============================================================================

// DeleteSession permanently removes a session.
func (s *SessionService) DeleteSession(id uuid.UUID) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := s.DB.ExecContext(ctx,
		`DELETE FROM editor_sessions WHERE session_id = $1`, id)
	return err
}
