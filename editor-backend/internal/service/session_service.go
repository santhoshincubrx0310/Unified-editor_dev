package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"editor-backend/internal/models"

	"github.com/google/uuid"
)

type SessionService struct {
	DB *sql.DB
}

func (s *SessionService) CreateSession(userID, contentID uuid.UUID) (*models.EditorSession, error) {

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

	err := s.DB.QueryRowContext(
		context.Background(),
		query,
		userID,
		contentID,
	).Scan(
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

	// Unmarshal JSONB
	if len(timelineJSON) > 0 {
		json.Unmarshal(timelineJSON, &session.Timeline)
	}

	return session, nil
}

func (s *SessionService) GetSession(id uuid.UUID) (*models.EditorSession, error) {

	query := `
	SELECT session_id, user_id, content_id, timeline, version, status, created_at, updated_at
	FROM editor_sessions_test
	WHERE session_id = $1
	`

	session := &models.EditorSession{}

	var timelineJSON []byte

	err := s.DB.QueryRowContext(context.Background(), query, id).Scan(
		&session.SessionID,
		&session.UserID,
		&session.ContentID,
		&timelineJSON,
		&session.Version,
		&session.Status,
		&session.CreatedAt,
		&session.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	json.Unmarshal(timelineJSON, &session.Timeline)

	return session, nil
}

func (s *SessionService) SaveSession(id uuid.UUID, timeline map[string]interface{}) error {

	timelineJSON, err := json.Marshal(timeline)
	if err != nil {
		return err
	}

	query := `
	UPDATE editor_sessions_test
	SET timeline = $1,
	    version = version + 1,
	    updated_at = NOW()
	WHERE session_id = $2
	`

	result, err := s.DB.ExecContext(context.Background(), query, timelineJSON, id)
	if err != nil {
		return err
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return errors.New("session not found")
	}

	return nil
}

func (s *SessionService) DeleteSession(id uuid.UUID) error {

	query := `DELETE FROM editor_sessions_test WHERE session_id = $1`

	_, err := s.DB.ExecContext(context.Background(), query, id)
	return err
}
