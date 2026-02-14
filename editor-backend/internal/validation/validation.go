package validation

import (
	"errors"
	"mime/multipart"
	"strings"
)

const (
	MaxFileSize = 500 * 1024 * 1024 // 500MB
)

var (
	ErrFileTooLarge    = errors.New("file too large - maximum 500MB allowed")
	ErrInvalidFileType = errors.New("invalid file type - only mp4, webm, mp3, wav, m4a, ogg allowed")
	ErrFilenameTooLong = errors.New("filename too long - maximum 255 characters")
	ErrEmptyFile       = errors.New("file is empty")
)

var AllowedMimeTypes = map[string]bool{
	"video/mp4":       true,
	"video/quicktime": true,
	"video/webm":      true,
	"audio/mpeg":      true,
	"audio/mp3":       true,
	"audio/mp4":       true,
	"audio/m4a":       true,
	"audio/wav":       true,
	"audio/wave":      true,
	"audio/x-wav":     true,
	"audio/ogg":       true,
	"audio/vorbis":    true,
}

func ValidateUpload(fileHeader *multipart.FileHeader) error {

	if fileHeader.Size == 0 {
		return ErrEmptyFile
	}

	if fileHeader.Size > MaxFileSize {
		return ErrFileTooLarge
	}

	if len(fileHeader.Filename) > 255 {
		return ErrFilenameTooLong
	}

	contentType := fileHeader.Header.Get("Content-Type")

	if contentType == "" {
		contentType = guessContentType(fileHeader.Filename)
	}

	if !AllowedMimeTypes[contentType] {
		return ErrInvalidFileType
	}

	return nil
}

func guessContentType(filename string) string {

	idx := strings.LastIndex(filename, ".")
	if idx == -1 {
		return "application/octet-stream"
	}

	ext := strings.ToLower(filename[idx+1:])

	typeMap := map[string]string{
		"mp4":  "video/mp4",
		"mov":  "video/quicktime",
		"webm": "video/webm",
		"mp3":  "audio/mpeg",
		"m4a":  "audio/mp4",
		"wav":  "audio/wav",
		"ogg":  "audio/ogg",
	}

	if ct, ok := typeMap[ext]; ok {
		return ct
	}

	return "application/octet-stream"
}

func ValidateContentID(contentID string) error {

	if contentID == "" {
		return errors.New("content_id is required")
	}

	if len(contentID) < 10 || len(contentID) > 100 {
		return errors.New("content_id must be between 10 and 100 characters")
	}

	return nil
}

func ValidateSessionName(name string) error {

	if len(name) > 255 {
		return errors.New("session name too long - maximum 255 characters")
	}

	return nil
}
