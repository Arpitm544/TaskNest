package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"
)

type storageConfig struct{ origin, secret, bucket string }

var bucketNamePattern = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$`)
var storageHTTPClient = &http.Client{Timeout: 30 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}

func ValidateStorageConfig() error {
	_, err := supabaseStorageConfig()
	return err
}

func supabaseStorageConfig() (storageConfig, error) {
	c := storageConfig{origin: strings.TrimRight(os.Getenv("SUPABASE_URL"), "/"), secret: os.Getenv("SUPABASE_SECRET_KEY"), bucket: os.Getenv("SUPABASE_STORAGE_BUCKET")}
	u, err := url.Parse(c.origin)
	if err != nil || u.Host == "" || (u.Scheme != "https" && u.Scheme != "http") || u.User != nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" {
		return c, fmt.Errorf("SUPABASE_URL must be your project's HTTPS origin")
	}
	if u.Scheme != "https" && (os.Getenv("GIN_MODE") == "release" || (u.Hostname() != "localhost" && u.Hostname() != "127.0.0.1" && u.Hostname() != "::1")) {
		return c, fmt.Errorf("SUPABASE_URL must use HTTPS except for local development")
	}
	if !strings.HasPrefix(c.secret, "sb_secret_") {
		return c, fmt.Errorf("SUPABASE_SECRET_KEY must be a backend secret key (sb_secret_...), not a publishable key")
	}
	if c.bucket == "" {
		c.bucket = "tasknest-uploads"
	}
	if !bucketNamePattern.MatchString(c.bucket) {
		return c, fmt.Errorf("SUPABASE_STORAGE_BUCKET contains unsupported characters")
	}
	return c, nil
}

func storageRequest(ctx context.Context, c storageConfig, method, path, contentType string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.origin+"/storage/v1/"+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", c.secret)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("x-upsert", "false")
	// New Supabase secret keys belong in apikey, never in Authorization: Bearer.
	response, err := storageHTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("unable to reach Supabase Storage")
	}
	return response, nil
}

func uploadSupabaseFile(ctx context.Context, data []byte, name, contentType string) (string, error) {
	c, err := supabaseStorageConfig()
	if err != nil {
		return "", err
	}
	key := "files/" + name
	path := "object/" + url.PathEscape(c.bucket) + "/" + key
	response, err := storageRequest(ctx, c, http.MethodPost, path, contentType, bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	io.Copy(io.Discard, io.LimitReader(response.Body, 1<<20))
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", fmt.Errorf("Supabase Storage upload failed (HTTP %d)", response.StatusCode)
	}
	return c.origin + "/storage/v1/object/public/" + url.PathEscape(c.bucket) + "/" + key, nil
}

// InitializeStorage creates the application's public asset bucket if missing.
// An existing private bucket is never silently made public.
func InitializeStorage(ctx context.Context) error {
	if err := ValidateStorageConfig(); err != nil {
		return err
	}
	c, err := supabaseStorageConfig()
	if err != nil {
		return err
	}
	response, err := storageRequest(ctx, c, http.MethodGet, "bucket/"+url.PathEscape(c.bucket), "application/json", nil)
	if err != nil {
		return err
	}
	missingBucket := response.StatusCode == http.StatusNotFound
	if response.StatusCode == http.StatusBadRequest {
		// Supabase can wrap a NoSuchBucket (404) error in an HTTP 400 response.
		// Only that specific code permits creation; credential errors must fail.
		var detail struct {
			Code string `json:"code"`
		}
		if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&detail); err == nil {
			missingBucket = detail.Code == "NoSuchBucket"
		}
	}
	if missingBucket {
		response.Body.Close()
		types := []string{"image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "application/pdf"}
		data, _ := json.Marshal(map[string]interface{}{"id": c.bucket, "name": c.bucket, "public": true, "file_size_limit": MaxUploadSize, "allowed_mime_types": types})
		response, err = storageRequest(ctx, c, http.MethodPost, "bucket", "application/json", bytes.NewReader(data))
		if err != nil {
			return err
		}
		defer response.Body.Close()
		if response.StatusCode >= 200 && response.StatusCode < 300 {
			return nil
		}
		return fmt.Errorf("create Supabase bucket failed (HTTP %d)", response.StatusCode)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("check Supabase bucket failed (HTTP %d)", response.StatusCode)
	}
	var bucket struct {
		Public bool `json:"public"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&bucket); err != nil {
		return fmt.Errorf("invalid Supabase bucket response")
	}
	if !bucket.Public {
		return fmt.Errorf("bucket %s is private; use a dedicated public asset bucket for TaskNest's permanent file URLs", c.bucket)
	}
	return nil
}
