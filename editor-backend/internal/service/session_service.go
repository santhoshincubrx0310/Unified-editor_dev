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

func (s *SessionService) findExistingSession(ctx context.Context, userID, contentID uuid.UUID) (*models.EditorSession, error) {
	query := `
		SELECT session_id, user_id, content_id, timeline, version, status, created_at, updated_at
		FROM editor_sessions_test
		WHERE user_id = $1 AND content_id = $2
		ORDER BY created_at DESC
		LIMIT 1
	`

	session := &models.EditorSession{}
	var timelineJSON []byte

	err := s.DB.QueryRowContext(ctx, query, userID, contentID).Scan(
		&session.SessionID,
		&session.UserID,
		&session.ContentID,
		&timelineJSON,
		&session.Version,
		&session.Status,
		&session.CreatedAt,
		&session.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrSessionNotFound
	}
	if err != nil {
		return nil, err
	}

	if len(timelineJSON) > 0 {
		json.Unmarshal(timelineJSON, &session.Timeline)
	}

	return session, nil
}

func (s *SessionService) createSession(ctx context.Context, userID, contentID uuid.UUID) (*models.EditorSession, error) {
	query := `
		INSERT INTO editor_sessions_test (user_id, content_id)
		VALUES ($1, $2)
		RETURNING session_id, timeline, version, status, created_at, updated_at
	`

	session := &models.EditorSession{
		UserID:    userID,
		ContentID: contentID,
	}
	var timelineJSON []byte

	err := s.DB.QueryRowContext(ctx, query, userID, contentID).Scan(
		&session.SessionID,
		&timelineJSON,
		&session.Version,
		&session.Status,
		&session.CreatedAt,
		&session.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if len(timelineJSON) > 0 {
		json.Unmarshal(timelineJSON, &session.Timeline)
	}

	return session, nil
}

// GetSession fetches a session and verifies ownership.
// Passing userID ensures one user cannot read another user's session.
// When gateway is wired up, this is the enforcement layer.
func (s *SessionService) GetSession(id, userID uuid.UUID) (*models.EditorSession, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		SELECT session_id, user_id, content_id, timeline, version, status, created_at, updated_at
		FROM editor_sessions_test
		WHERE session_id = $1
	`

	session := &models.EditorSession{}
	var timelineJSON []byte

	err := s.DB.QueryRowContext(ctx, query, id).Scan(
		&session.SessionID,
		&session.UserID,
		&session.ContentID,
		&timelineJSON,
		&session.Version,
		&session.Status,
		&session.CreatedAt,
		&session.UpdatedAt,
	)
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

	if len(timelineJSON) > 0 {
		json.Unmarshal(timelineJSON, &session.Timeline)
	}

	return session, nil
}

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
		UPDATE editor_sessions_test
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

// DeleteSession permanently removes a session.
func (s *SessionService) DeleteSession(id uuid.UUID) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := s.DB.ExecContext(ctx,
		`DELETE FROM editor_sessions_test WHERE session_id = $1`, id)
	return err
}
