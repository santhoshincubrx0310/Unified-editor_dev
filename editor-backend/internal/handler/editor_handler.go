// internal/handler/editor_handler.go
package handler

import (
	"context"
	"editor-backend/internal/models"
	"editor-backend/internal/service"
	"editor-backend/internal/storage"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"editor-backend/internal/validation"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

type EditorHandler struct {
	Service *service.SessionService
	Storage storage.Storage
}

// ── Repurposer Integration ────────────────────────────────────────────────────

// RepurposerClip represents clip metadata returned by the Repurposer backend.
type RepurposerClip struct {
	ClipID      string  `json:"clip_id"`
	SourceVideo string  `json:"source_video"`
	StartTime   float64 `json:"start_time"`
	EndTime     float64 `json:"end_time"`
	Duration    float64 `json:"duration"`
	Score       float64 `json:"score"`
	Topic       string  `json:"topic"`
	Platform    string  `json:"platform"`
}

// RepurposerResponse is the response structure from Repurposer backend.
type RepurposerResponse struct {
	Clips []RepurposerClip `json:"clips"`
}

// FetchRepurposerClips retrieves clip metadata from the Repurposer backend.
// Production implementation with timeout and proper error handling.
func FetchRepurposerClips(contentID string) ([]RepurposerClip, error) {
	// Get Repurposer backend URL from environment
	repurposerURL := os.Getenv("REPURPOSER_BACKEND_URL")
	if repurposerURL == "" {
		repurposerURL = "http://localhost:8085" // Dev fallback
	}

	// Build request URL
	url := fmt.Sprintf("%s/api/repurposer/clips/%s", repurposerURL, contentID)

	// Create context with timeout — prevents hanging on slow Repurposer backend
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Create HTTP request with context
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Execute request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch clips from Repurposer: %w", err)
	}
	defer resp.Body.Close()

	// Check HTTP status
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Repurposer returned status %d", resp.StatusCode)
	}

	// Decode response
	var repurposerResp RepurposerResponse
	if err := json.NewDecoder(resp.Body).Decode(&repurposerResp); err != nil {
		return nil, fmt.Errorf("failed to decode Repurposer response: %w", err)
	}

	return repurposerResp.Clips, nil
}

// ── Handlers ───────────────────────────────────────────────────────────────────

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
		ClipID        string  `json:"clip_id"`
		ClipURL       string  `json:"clip_url"`
		Duration      float64 `json:"duration"`
		SourceAssetID string  `json:"source_asset_id,omitempty"`
		SourceJobID   string  `json:"source_job_id,omitempty"`
		SourceModule  string  `json:"source_module,omitempty"`
		Platform      string  `json:"platform,omitempty"`
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

	// Create session with source tracking if provided
	var session *models.EditorSession
	if req.SourceAssetID != "" || req.SourceJobID != "" {
		session, err = h.Service.FindOrCreateSessionWithSource(
			userID, contentID,
			req.SourceAssetID, req.SourceJobID, req.SourceModule, req.Platform,
		)
	} else {
		session, err = h.Service.FindOrCreateSession(userID, contentID)
	}

	if err != nil {
		log.Println("CreateSessionFromClip error:", err)
		respondError(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	// Create timeline with clip preloaded
	timeline := map[string]interface{}{
		"session_type": "standard",
		"duration":     req.Duration,
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

// CreateHighlightSession creates a highlight reel session from multiple clips.
// Used by Phase 2 repurposer integration to create multi-clip highlight reels.
// Fetches full clip metadata from Repurposer backend and builds proper timeline.
func (h *EditorHandler) CreateHighlightSession(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ContentID      string   `json:"content_id"`
		ClipIDs        []string `json:"clip_ids"`
		TargetDuration int      `json:"target_duration"`
		SourceAssetID  string   `json:"source_asset_id,omitempty"`
		SourceJobID    string   `json:"source_job_id,omitempty"`
		SourceModule   string   `json:"source_module,omitempty"`
		Platform       string   `json:"platform,omitempty"`
	}

	// Decode request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Validate input
	if req.ContentID == "" {
		respondError(w, http.StatusBadRequest, "content_id is required")
		return
	}

	if len(req.ClipIDs) == 0 {
		respondError(w, http.StatusBadRequest, "clip_ids cannot be empty")
		return
	}

	if req.TargetDuration <= 0 {
		respondError(w, http.StatusBadRequest, "target_duration must be greater than 0")
		return
	}

	// Get authenticated user
	userID, err := getUserID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid user")
		return
	}

	// Parse content ID
	contentID, err := uuid.Parse(req.ContentID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "content_id must be a valid UUID")
		return
	}

	// Fetch clip metadata from Repurposer backend
	repurposerClips, err := FetchRepurposerClips(req.ContentID)
	if err != nil {
		log.Printf("Failed to fetch clips from Repurposer for content_id=%s: %v", req.ContentID, err)
		respondError(w, http.StatusBadGateway, "failed to fetch clip metadata from Repurposer")
		return
	}

	// Build clip lookup map for O(1) access
	clipMap := make(map[string]RepurposerClip)
	for _, clip := range repurposerClips {
		clipMap[clip.ClipID] = clip
	}

	// Build timeline clips array with full metadata
	timelineClips := make([]interface{}, 0, len(req.ClipIDs))
	for _, clipID := range req.ClipIDs {
		clip, found := clipMap[clipID]
		if !found {
			log.Printf("Warning: clip_id=%s not found in Repurposer response", clipID)
			// Skip missing clips instead of failing — allows partial success
			continue
		}

		timelineClips = append(timelineClips, map[string]interface{}{
			"id":            clip.ClipID,
			"src":           clip.SourceVideo,
			"start":         clip.StartTime,
			"end":           clip.EndTime,
			"duration":      clip.Duration,
			"platform":      clip.Platform,
			"score":         clip.Score,
			"topic":         clip.Topic,
			"ai_generated":  true,
			"source_module": "repurposer",
		})
	}

	// Ensure at least one clip was matched
	if len(timelineClips) == 0 {
		respondError(w, http.StatusBadRequest, "no matching clips found in Repurposer response")
		return
	}

	// Create session with source tracking
	session, err := h.Service.FindOrCreateSessionWithSource(
		userID, contentID,
		req.SourceAssetID, req.SourceJobID, req.SourceModule, req.Platform,
	)
	if err != nil {
		log.Println("CreateHighlightSession error:", err)
		respondError(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	// Build complete highlight reel timeline with full clip metadata
	timeline := map[string]interface{}{
		"session_type":    "highlight_reel",
		"target_duration": req.TargetDuration,
		"tracks": []interface{}{
			map[string]interface{}{
				"type":  "video",
				"clips": timelineClips,
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

// ExportSession initiates export for a completed editing session.
// Stub implementation — actual export logic will be added in Phase 3.
func (h *EditorHandler) ExportSession(w http.ResponseWriter, r *http.Request) {
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

	// Verify session ownership
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

	// Stub response — Phase 3 will implement actual export
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"status":        "export started",
		"session_id":    session.SessionID,
		"export_status": "processing",
	})
}
