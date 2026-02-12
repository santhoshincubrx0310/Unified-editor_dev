// cmd/api/main.go
package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"editor-backend/internal/handler"
	"editor-backend/internal/service"
	"editor-backend/internal/storage"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	// Load .env in dev only — production injects env vars through infra (K8s secrets, etc.)
	if os.Getenv("APP_ENV") != "production" {
		godotenv.Load()
	}

	// ── Database ──────────────────────────────────────────────────────────────
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal("Failed to open DB:", err)
	}
	defer db.Close()

	// Connection pool — prevents overwhelming DB under concurrent load
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Verify connection at startup — fail fast rather than accepting traffic
	pingCtx, pingCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer pingCancel()
	if err := db.PingContext(pingCtx); err != nil {
		log.Fatal("Database ping failed:", err)
	}

	var dbName string
	db.QueryRow("SELECT current_database()").Scan(&dbName)
	fmt.Println("Connected to database:", dbName)

	// ── Storage (swappable: LocalStorage today → S3 tomorrow) ─────────────────
	// Infra team sets STORAGE_TYPE=s3 and AWS_* vars when ready.
	// Your handler/service code never changes — only this wiring changes.
	var fileStorage storage.Storage
	if os.Getenv("STORAGE_TYPE") == "s3" {
		fileStorage = storage.NewS3Storage(
			os.Getenv("AWS_BUCKET"),
			os.Getenv("AWS_REGION"),
		)
		log.Println("Using S3 storage")
	} else {
		uploadDir := os.Getenv("UPLOAD_DIR")
		if uploadDir == "" {
			uploadDir = "./uploads"
		}
		fileStorage = storage.NewLocalStorage(uploadDir, os.Getenv("BASE_URL"))
		log.Println("Using local storage at", uploadDir)
	}

	// ── Services & Handlers ───────────────────────────────────────────────────
	sessionService := &service.SessionService{DB: db}
	editorHandler := &handler.EditorHandler{
		Service: sessionService,
		Storage: fileStorage,
	}

	// ── Router ────────────────────────────────────────────────────────────────
	r := mux.NewRouter()

	// Health check — required by load balancers and Kubernetes liveness probes
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		if err := db.PingContext(r.Context()); err != nil {
			http.Error(w, `{"status":"unhealthy"}`, http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	}).Methods("GET")

	// API routes — versioned so parent product can call /api/v1/* without conflicts
	api := r.PathPrefix("/api/v1").Subrouter()
	api.HandleFunc("/sessions", editorHandler.CreateSession).Methods("POST")
	api.HandleFunc("/sessions/{id}", editorHandler.GetSession).Methods("GET")
	api.HandleFunc("/sessions/{id}", editorHandler.SaveSession).Methods("PUT")
	api.HandleFunc("/sessions/{id}", editorHandler.DeleteSession).Methods("DELETE")
	api.HandleFunc("/upload", editorHandler.UploadFile).Methods("POST")

	// Serve local uploads — in production, S3 serves files directly (this route unused)
	r.PathPrefix("/uploads/").Handler(
		http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))),
	)

	// ── CORS — read from env, not hardcoded ────────────────────────────────────
	// Dev:        ALLOWED_ORIGINS=http://localhost:5173
	// Staging:    ALLOWED_ORIGINS=https://staging.yourproduct.com
	// Production: ALLOWED_ORIGINS=https://yourproduct.com
	allowedOrigins := os.Getenv("ALLOWED_ORIGINS")
	if allowedOrigins == "" {
		allowedOrigins = "http://localhost:5173"
	}

	cors := handlers.CORS(
		handlers.AllowedOrigins([]string{allowedOrigins}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		// X-User-ID: will be injected by API gateway in production
		handlers.AllowedHeaders([]string{"Content-Type", "X-User-ID", "Authorization"}),
	)

	// ── HTTP Server with timeouts ──────────────────────────────────────────────
	// Without timeouts, a slow client can hold a connection open forever.
	// This protects your service under load.
	port := os.Getenv("PORT")
	if port == "" {
		port = "8083"
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      cors(r),
		ReadTimeout:  10 * time.Second, // Time to read the full request
		WriteTimeout: 30 * time.Second, // Time to write the response (30s for uploads)
		IdleTimeout:  60 * time.Second, // Keep-alive connection timeout
	}

	// ── Graceful Shutdown ──────────────────────────────────────────────────────
	// When the parent product's infra sends SIGTERM (e.g., during deploy/scale-down),
	// we finish in-flight requests before exiting — no requests dropped mid-save.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("Editor service running on :%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("Server error:", err)
		}
	}()

	<-quit
	log.Println("Shutdown signal received — draining requests...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatal("Forced shutdown:", err)
	}
	log.Println("Server stopped cleanly")
}
