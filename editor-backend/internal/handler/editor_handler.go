package handler

import (
	"editor-backend/internal/service"
	"encoding/json"
	"log"
	"net/http"

	"io"

	"os"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

type EditorHandler struct {
	Service *service.SessionService
}

func (h *EditorHandler) CreateSession(w http.ResponseWriter, r *http.Request) {

	var req struct {
		UserID    string `json:"user_id"`
		ContentID string `json:"content_id"`
	}

	json.NewDecoder(r.Body).Decode(&req)

	userUUID, _ := uuid.Parse(req.UserID)
	contentUUID, _ := uuid.Parse(req.ContentID)

	session, err := h.Service.CreateSession(userUUID, contentUUID)
	if err != nil {
		log.Println("CreateSession ERROR:", err)
		http.Error(w, err.Error(), 500)
		return
	}

	json.NewEncoder(w).Encode(session)
}

func (h *EditorHandler) GetSession(w http.ResponseWriter, r *http.Request) {

	idParam := mux.Vars(r)["id"]
	id, _ := uuid.Parse(idParam)

	session, err := h.Service.GetSession(id)
	if err != nil {
		http.Error(w, err.Error(), 404)
		return
	}

	json.NewEncoder(w).Encode(session)
}

func (h *EditorHandler) SaveSession(w http.ResponseWriter, r *http.Request) {

	idParam := mux.Vars(r)["id"]
	id, _ := uuid.Parse(idParam)

	var body struct {
		Timeline map[string]interface{} `json:"timeline"`
	}

	err := json.NewDecoder(r.Body).Decode(&body)
	if err != nil {
		http.Error(w, "invalid JSON", 400)
		return
	}

	err = h.Service.SaveSession(id, body.Timeline)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "saved",
	})
}
func (h *EditorHandler) UploadFile(w http.ResponseWriter, r *http.Request) {

	r.ParseMultipartForm(10 << 20) // 10MB limit

	file, handler, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Invalid file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	filePath := "./uploads/" + handler.Filename

	dst, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "Unable to save file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	_, err = io.Copy(dst, file)
	if err != nil {
		http.Error(w, "File save failed", http.StatusInternalServerError)
		return
	}

	fileURL := "http://localhost:8083/uploads/" + handler.Filename

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"file_url": fileURL,
	})
}

func (h *EditorHandler) DeleteSession(w http.ResponseWriter, r *http.Request) {

	idParam := mux.Vars(r)["id"]
	id, _ := uuid.Parse(idParam)

	err := h.Service.DeleteSession(id)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "deleted",
	})
}
