// internal/handler/editor_handler.go
package handler

import (
	"editor-backend/internal/service"
	"editor-backend/internal/storage"
	"encoding/json"
	"log"
	"net/http"

	"editor-backend/internal/validation"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

type EditorHandler struct {
	Service *service.SessionService
	Storage storage.Storage
}

// getUserID reads the user identity injected by the API gateway.
//
// Production flow:
//
//	Browser → API Gateway (validates JWT) → injects X-User-ID header → Editor Service
//
// The frontend never sends user_id. The gateway is the single authority on identity.
// This means your editor module works correctly whether accessed directly by a user
// or called programmatically by another service — identity always comes from the gateway.
//
// Development flow (no gateway):
//
//	You can send X-User-ID manually in Postman/curl until the gateway is wired up.
func getUserID(r *http.Request) (uuid.UUID, error) {
	userIDStr := r.Header.Get("X-User-ID")
	if userIDStr == "" {
		// Dev fallback — remove this block when gateway is wired up
		log.Println("WARNING: No X-User-ID header — using dev placeholder. Do NOT ship this to prod without a gateway.")
		return uuid.MustParse("11111111-1111-1111-1111-111111111111"), nil
	}
	parsed, err := uuid.Parse(userIDStr)
	if err != nil {
		return uuid.Nil, err
	}
	return parsed, nil
}

// CreateSession creates or retrieves an editing session for a given content_id.
//
// Key design: We look up an EXISTING session for this user+content before creating one.
// This fixes the 164-orphaned-rows problem — refreshing the page now reuses the same session
// instead of creating a new one every time.
//
// Request body: { "content_id": "uuid" }
// No user_id in body — comes from X-User-ID header (gateway-injected)
func (h *EditorHandler) CreateSession(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ContentID string `json:"content_id"`
		// user_id intentionally NOT here — never trust frontend for identity
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.ContentID == "" {
		respondError(w, http.StatusBadRequest, "content_id is required")
		return
	}

	contentID, err := uuid.Parse(req.ContentID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "content_id must be a valid UUID")
		return
	}

	userID, err := getUserID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid X-User-ID header")
		return
	}

	// FindOrCreate: reuse existing session instead of spawning new orphans
	session, err := h.Service.FindOrCreateSession(userID, contentID)
	if err != nil {
		log.Println("CreateSession error:", err)
		respondError(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	respondJSON(w, http.StatusOK, session)
}

// GetSession fetches a session by ID.
// Validates the session belongs to the requesting user (ownership check).
func (h *EditorHandler) GetSession(w http.ResponseWriter, r *http.Request) {
	sessionID, err := parseUUIDParam(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid session id — must be a UUID")
		return
	}

	userID, err := getUserID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid X-User-ID header")
		return
	}

	session, err := h.Service.GetSession(sessionID, userID)
	if err != nil {
		if err == service.ErrSessionNotFound {
			respondError(w, http.StatusNotFound, "session not found")
			return
		}
		if err == service.ErrUnauthorized {
			respondError(w, http.StatusForbidden, "you do not own this session")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to get session")
		return
	}

	respondJSON(w, http.StatusOK, session)
}

// SaveSession persists the timeline state for a session.
func (h *EditorHandler) SaveSession(w http.ResponseWriter, r *http.Request) {
	sessionID, err := parseUUIDParam(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid session id — must be a UUID")
		return
	}

	var body struct {
		Timeline map[string]interface{} `json:"timeline"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if body.Timeline == nil {
		respondError(w, http.StatusBadRequest, "timeline is required")
		return
	}

	if err := h.Service.SaveSession(sessionID, body.Timeline); err != nil {
		log.Println("SaveSession error:", err)
		if err == service.ErrSessionNotFound {
			respondError(w, http.StatusNotFound, "session not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to save session")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "saved"})
}

// DeleteSession permanently removes a session.
func (h *EditorHandler) DeleteSession(w http.ResponseWriter, r *http.Request) {
	sessionID, err := parseUUIDParam(r, "id")
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid session id — must be a UUID")
		return
	}

	if err := h.Service.DeleteSession(sessionID); err != nil {
		log.Println("DeleteSession error:", err)
		respondError(w, http.StatusInternalServerError, "failed to delete session")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// UploadFile handles media uploads with type validation and safe filenames.
func (h *EditorHandler) UploadFile(w http.ResponseWriter, r *http.Request) {

	if err := r.ParseMultipartForm(validation.MaxFileSize); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	file, fileHeader, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "missing file")
		return
	}
	defer file.Close()

	// production validation
	if err := validation.ValidateUpload(fileHeader); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	contentType := fileHeader.Header.Get("Content-Type")

	fileURL, err := h.Storage.Upload(file, fileHeader.Filename, contentType)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"file_url": fileURL,
	})
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func parseUUIDParam(r *http.Request, param string) (uuid.UUID, error) {
	// uuid.Parse returns an error instead of silently returning uuid.Nil
	return uuid.Parse(mux.Vars(r)[param])
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}
func (h *EditorHandler) CreateSessionFromClip(w http.ResponseWriter, r *http.Request) {

	var req struct {
		ClipID   string  `json:"clip_id"`
		ClipURL  string  `json:"clip_url"`
		Duration float64 `json:"duration"`
	}

	// Decode request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Validate input
	if req.ClipURL == "" {
		respondError(w, http.StatusBadRequest, "clip_url is required")
		return
	}

	if req.Duration <= 0 {
		respondError(w, http.StatusBadRequest, "duration must be greater than 0")
		return
	}

	// Get authenticated user
	userID, err := getUserID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user")
		return
	}

	// Generate new content ID for this clip session
	contentID := uuid.New()

	// Create session
	session, err := h.Service.FindOrCreateSession(userID, contentID)
	if err != nil {
		log.Println("CreateSessionFromClip error:", err)
		respondError(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	// Create timeline with clip preloaded
	timeline := map[string]interface{}{
		"duration": req.Duration,
		"tracks": []interface{}{
			map[string]interface{}{
				"type":    "video",
				"visible": true,
				"muted":   false,
				"clips": []interface{}{
					map[string]interface{}{
						"id":       req.ClipID,
						"src":      req.ClipURL,
						"start":    0,
						"end":      req.Duration,
						"duration": req.Duration,
					},
				},
			},
		},
	}

	// Save timeline
	err = h.Service.SaveSession(session.SessionID, timeline)
	if err != nil {
		log.Println("SaveSession error:", err)
		respondError(w, http.StatusInternalServerError, "failed to save session timeline")
		return
	}

	// Fetch updated session with timeline
	updatedSession, err := h.Service.GetSession(session.SessionID, userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fetch updated session")
		return
	}

	// Return updated session
	respondJSON(w, http.StatusOK, updatedSession)
}
