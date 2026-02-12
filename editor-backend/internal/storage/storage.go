// internal/storage/storage.go
package storage

import (
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"

	"github.com/google/uuid"
)

// Storage is the only interface your handler depends on.
// Swap the implementation in main.go — handler and service code never changes.
//
//	Today:    fileStorage = storage.NewLocalStorage(...)
//	Tomorrow: fileStorage = storage.NewS3Storage(...)   ← one line change
type Storage interface {
	Upload(file multipart.File, filename string, contentType string) (string, error)
}

// ── Local Storage ─────────────────────────────────────────────────────────────

// local.go

type LocalStorage struct {
	UploadDir string
	BaseURL   string // e.g. "http://localhost:8083"
}

func NewLocalStorage(uploadDir, baseURL string) *LocalStorage {
	// Create upload directory if it doesn't exist
	os.MkdirAll(uploadDir, 0755)
	return &LocalStorage{UploadDir: uploadDir, BaseURL: baseURL}
}

func (s *LocalStorage) Upload(file multipart.File, filename string, contentType string) (string, error) {
	// Use UUID as filename — prevents:
	//   1. Path traversal attacks (../../etc/passwd)
	//   2. Filename collisions between users
	//   3. Information leakage (original filenames)
	ext := filepath.Ext(filename)
	safeFilename := uuid.New().String() + ext

	filePath := filepath.Join(s.UploadDir, safeFilename)

	dst, err := os.Create(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to create file: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	// BaseURL comes from env — works in any environment without code changes
	// Dev:  BASE_URL=http://localhost:8083
	// Prod: BASE_URL=https://api.yourproduct.com
	fileURL := fmt.Sprintf("%s/uploads/%s", s.BaseURL, safeFilename)
	return fileURL, nil
}

// ── S3 Storage stub ───────────────────────────────────────────────────────────

// s3.go
// Infra team fills this in when moving off local storage.
// Handler and service code require zero changes.

type S3Storage struct {
	Bucket string
	Region string
}

func NewS3Storage(bucket, region string) *S3Storage {
	return &S3Storage{Bucket: bucket, Region: region}
}

func (s *S3Storage) Upload(file multipart.File, filename string, contentType string) (string, error) {
	// TODO (infra team): implement with AWS SDK v2
	//
	// cfg, _ := config.LoadDefaultConfig(context.TODO(), config.WithRegion(s.Region))
	// client := s3.NewFromConfig(cfg)
	// uploader := manager.NewUploader(client)
	//
	// result, err := uploader.Upload(context.TODO(), &s3.PutObjectInput{
	//     Bucket:      aws.String(s.Bucket),
	//     Key:         aws.String(filename),
	//     Body:        file,
	//     ContentType: aws.String(contentType),
	// })
	// return result.Location, err

	return "", fmt.Errorf("S3 storage not yet configured — set STORAGE_TYPE=local or implement S3")
}
