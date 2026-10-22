package services

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
)

const MaxUploadSize int64 = 10 << 20

var ErrUploadTooLarge = errors.New("file must be 10 MB or smaller")
var ErrUploadType = errors.New("only PNG, JPEG, GIF, WebP, AVIF images and PDF files are allowed")

var allowedUploadTypes = map[string]string{
	"image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif",
	"image/webp": ".webp", "image/avif": ".avif", "application/pdf": ".pdf",
}

// UploadFile detects the actual content, limits size, and ignores client filenames.
func UploadFile(file multipart.File, _ string) (string, error) {
	if err := ValidateStorageConfig(); err != nil {
		return "", err
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", err
	}
	data, err := io.ReadAll(io.LimitReader(file, MaxUploadSize+1))
	if err != nil {
		return "", err
	}
	if int64(len(data)) > MaxUploadSize {
		return "", ErrUploadTooLarge
	}
	contentType := http.DetectContentType(data)
	// AVIF's ISO-BMFF signature is not recognized by Go's MIME detector.
	if len(data) >= 12 && string(data[4:8]) == "ftyp" && (string(data[8:12]) == "avif" || string(data[8:12]) == "avis") {
		contentType = "image/avif"
	}
	extension, ok := allowedUploadTypes[contentType]
	if !ok {
		return "", ErrUploadType
	}
	id := make([]byte, 16)
	if _, err := rand.Read(id); err != nil {
		return "", err
	}
	name := fmt.Sprintf("%x%s", id, extension)
	return uploadSupabaseFile(context.Background(), data, name, contentType)
}
