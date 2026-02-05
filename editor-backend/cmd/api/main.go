package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"

	"editor-backend/internal/handler"
	"editor-backend/internal/service"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {

	godotenv.Load()

	dbURL := os.Getenv("DATABASE_URL")
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal(err)
	}

	err = db.Ping()
	if err != nil {
		log.Fatal("Database connection failed:", err)
	}

	var dbName string
	err = db.QueryRow("SELECT current_database()").Scan(&dbName)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("Connected to database:", dbName)

	sessionService := &service.SessionService{DB: db}
	editorHandler := &handler.EditorHandler{Service: sessionService}

	r := mux.NewRouter()

	// SESSION ROUTES
	r.HandleFunc("/sessions", editorHandler.CreateSession).Methods("POST")
	r.HandleFunc("/sessions/{id}", editorHandler.GetSession).Methods("GET")
	r.HandleFunc("/sessions/{id}", editorHandler.SaveSession).Methods("PUT")
	r.HandleFunc("/sessions/{id}", editorHandler.DeleteSession).Methods("DELETE")

	// FILE UPLOAD ROUTE
	r.HandleFunc("/upload", editorHandler.UploadFile).Methods("POST")

	// Serve uploaded files
	r.PathPrefix("/uploads/").
		Handler(http.StripPrefix("/uploads/",
			http.FileServer(http.Dir("./uploads"))))

	cors := handlers.CORS(
		handlers.AllowedOrigins([]string{"http://localhost:5173"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE"}),
		handlers.AllowedHeaders([]string{"Content-Type"}),
	)

	log.Println("Server running on port 8083")
	log.Fatal(http.ListenAndServe(":8083", cors(r)))
}
