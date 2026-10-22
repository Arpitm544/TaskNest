package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
)

type storageTransport func(*http.Request) (*http.Response, error)

func (f storageTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func mockStorage(t *testing.T, handle storageTransport) {
	t.Helper()
	t.Setenv("GIN_MODE", "debug")
	t.Setenv("SUPABASE_URL", "https://project.supabase.co")
	t.Setenv("SUPABASE_SECRET_KEY", "sb_secret_test_only")
	t.Setenv("SUPABASE_STORAGE_BUCKET", "tasknest-uploads")
	old := storageHTTPClient.Transport
	storageHTTPClient.Transport = handle
	t.Cleanup(func() { storageHTTPClient.Transport = old })
}
func storageResponse(status int, body string) *http.Response {
	return &http.Response{StatusCode: status, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}
}
func uploadFixture(t *testing.T, data string, filename string) (string, error) {
	t.Helper()
	file, err := os.CreateTemp(t.TempDir(), "upload")
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	if _, err := file.WriteString(data); err != nil {
		t.Fatal(err)
	}
	return UploadFile(file, filename)
}
func TestSupabaseUploadUsesServerKeyAndSafePermanentURL(t *testing.T) {
	calls := 0
	mockStorage(t, func(r *http.Request) (*http.Response, error) {
		calls++
		if r.Method != "POST" || !strings.HasPrefix(r.URL.Path, "/storage/v1/object/tasknest-uploads/files/") {
			t.Fatalf("unexpected upload route %s", r.URL.Path)
		}
		if r.Header.Get("apikey") != "sb_secret_test_only" || r.Header.Get("Authorization") != "" {
			t.Fatal("secret key must be sent only as apikey")
		}
		if r.Header.Get("Content-Type") != "application/pdf" || r.Header.Get("x-upsert") != "false" {
			t.Fatal("missing upload metadata")
		}
		body, _ := io.ReadAll(r.Body)
		if string(body) != "%PDF-1.4\nexample" {
			t.Fatal("upload bytes changed")
		}
		return storageResponse(200, `{"Key":"ignored"}`), nil
	})
	result, err := uploadFixture(t, "%PDF-1.4\nexample", "../../unsafe.html")
	if err != nil {
		t.Fatal(err)
	}
	if calls != 1 || !strings.HasPrefix(result, "https://project.supabase.co/storage/v1/object/public/tasknest-uploads/files/") || !strings.HasSuffix(result, ".pdf") || strings.Contains(result, "secret") || strings.Contains(result, "unsafe") {
		t.Fatalf("incorrect public URL %s", result)
	}
}
func TestUploadsRejectSpoofedTypesAndOversizedFiles(t *testing.T) {
	mockStorage(t, func(*http.Request) (*http.Response, error) {
		t.Fatal("invalid files must not reach Supabase")
		return nil, nil
	})
	if _, err := uploadFixture(t, "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>", "image.png"); err != ErrUploadType {
		t.Fatalf("spoofed image accepted: %v", err)
	}
	if _, err := uploadFixture(t, "%PDF-1.4"+strings.Repeat("x", int(MaxUploadSize)), "large.pdf"); err != ErrUploadTooLarge {
		t.Fatalf("oversized file accepted: %v", err)
	}
}
func TestSupabaseUploadErrorDoesNotExposeProviderBodyOrFollowRedirect(t *testing.T) {
	for _, status := range []int{403, 500, 307} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			calls := 0
			mockStorage(t, func(*http.Request) (*http.Response, error) {
				calls++
				r := storageResponse(status, "sb_secret_test_only provider internals")
				r.Header.Set("Location", "https://other.invalid/capture")
				return r, nil
			})
			_, err := uploadFixture(t, "%PDF-1.4\nexample", "document.pdf")
			if err == nil || strings.Contains(err.Error(), "sb_secret") || strings.Contains(err.Error(), "provider internals") || calls != 1 {
				t.Fatal("unsafe provider error or redirect behavior")
			}
		})
	}
}
func TestInitializeStorageCreatesMissingPublicBucket(t *testing.T) {
	calls := 0
	mockStorage(t, func(r *http.Request) (*http.Response, error) {
		calls++
		if calls == 1 {
			if r.Method != "GET" {
				t.Fatal("must inspect bucket before creation")
			}
			return storageResponse(404, `{}`), nil
		}
		if r.Method != "POST" || r.URL.Path != "/storage/v1/bucket" {
			t.Fatal("wrong bucket creation route")
		}
		var body struct {
			Public bool   `json:"public"`
			Limit  int64  `json:"file_size_limit"`
			Name   string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if !body.Public || body.Limit != MaxUploadSize || body.Name != "tasknest-uploads" {
			t.Fatal("incorrect bucket settings")
		}
		return storageResponse(200, `{}`), nil
	})
	if err := InitializeStorage(context.Background()); err != nil {
		t.Fatal(err)
	}
	if calls != 2 {
		t.Fatal("missing bucket was not created")
	}
}
func TestInitializeStorageDoesNotExposeExistingPrivateBucket(t *testing.T) {
	calls := 0
	mockStorage(t, func(*http.Request) (*http.Response, error) {
		calls++
		return storageResponse(200, `{"public":false}`), nil
	})
	if err := InitializeStorage(context.Background()); err == nil || calls != 1 {
		t.Fatal("must not turn an existing private bucket public")
	}
}
func TestSupabaseConfigurationRejectsBrowserKeysAndInsecureProduction(t *testing.T) {
	mockStorage(t, nil)
	for _, key := range []string{"", "sb_publishable_test", "eyJlegacy"} {
		t.Setenv("SUPABASE_SECRET_KEY", key)
		if ValidateStorageConfig() == nil {
			t.Fatal("accepted an unsupported server key")
		}
	}
	t.Setenv("SUPABASE_SECRET_KEY", "sb_secret_test_only")
	t.Setenv("GIN_MODE", "release")
	t.Setenv("SUPABASE_URL", "http://project.supabase.co")
	if ValidateStorageConfig() == nil {
		t.Fatal("production must use HTTPS")
	}
}

func TestInitializeStorageRecognizesWrappedMissingBucket(t *testing.T) {
	calls := 0
	mockStorage(t, func(r *http.Request) (*http.Response, error) {
		calls++
		if calls == 1 {
			return storageResponse(400, `{"statusCode":"404","code":"NoSuchBucket","error":"Bucket not found"}`), nil
		}
		if r.Method != "POST" || r.URL.Path != "/storage/v1/bucket" {
			t.Fatal("missing bucket must be created")
		}
		return storageResponse(200, `{}`), nil
	})
	if err := InitializeStorage(context.Background()); err != nil {
		t.Fatal(err)
	}
	if calls != 2 {
		t.Fatal("wrapped missing bucket did not trigger creation")
	}
}
func TestInitializeStorageDoesNotCreateBucketOnOtherBadRequests(t *testing.T) {
	for _, body := range []string{`{"code":"AccessDenied"}`, `{"statusCode":"404","code":"OtherError"}`, `invalid response`} {
		t.Run(body, func(t *testing.T) {
			calls := 0
			mockStorage(t, func(*http.Request) (*http.Response, error) { calls++; return storageResponse(400, body), nil })
			if err := InitializeStorage(context.Background()); err == nil || calls != 1 {
				t.Fatal("unrelated API errors must not trigger bucket creation")
			}
		})
	}
}

func TestInitializeStorageRechecksConcurrentBucketCreation(t *testing.T) {
	for _, public := range []bool{true, false} {
		for _, status := range []int{409, 400} {
			t.Run(fmt.Sprintf("%d/public=%t", status, public), func(t *testing.T) {
				calls := 0
				mockStorage(t, func(r *http.Request) (*http.Response, error) {
					calls++
					switch calls {
					case 1:
						return storageResponse(404, `{}`), nil
					case 2:
						return storageResponse(status, `{"code":"Duplicate","statusCode":"409"}`), nil
					case 3:
						if r.Method != "GET" {
							t.Fatal("must recheck after conflict")
						}
						return storageResponse(200, fmt.Sprintf(`{"public":%t}`, public)), nil
					default:
						t.Fatal("unexpected request")
						return nil, nil
					}
				})
				err := InitializeStorage(context.Background())
				if (err == nil) != public || calls != 3 {
					t.Fatalf("public=%t calls=%d err=%v", public, calls, err)
				}
			})
		}
	}
}

func TestAVIFRequiresBoundedFileTypeBox(t *testing.T) {
	calls := 0
	mockStorage(t, func(r *http.Request) (*http.Response, error) {
		calls++
		if r.Header.Get("Content-Type") != "image/avif" {
			t.Fatal("missing AVIF content type")
		}
		return storageResponse(200, `{}`), nil
	})
	for _, data := range []string{"textftypavifxxxx", "\x00\x00\x00\x00ftypavifxxxx", "\x00\x00\x00\x0cftypavifxxxx", "\x00\x00\x01\x00ftypavifxxxx"} {
		if _, err := uploadFixture(t, data, "spoof.avif"); err != ErrUploadType {
			t.Fatalf("accepted invalid box: %v", err)
		}
	}
	if _, err := uploadFixture(t, "\x00\x00\x00\x10ftypavif\x00\x00\x00\x00", "valid.avif"); err != nil {
		t.Fatal(err)
	}
	if calls != 1 {
		t.Fatal("invalid content reached storage")
	}
}

func TestStorageTransportPreservesCause(t *testing.T) {
	cause := errors.New("transport unavailable")
	mockStorage(t, func(*http.Request) (*http.Response, error) { return nil, cause })
	_, err := storageRequest(context.Background(), storageConfig{origin: "https://example.invalid"}, "GET", "bucket", "application/json", nil)
	if !errors.Is(err, cause) {
		t.Fatalf("lost underlying error: %v", err)
	}
}
