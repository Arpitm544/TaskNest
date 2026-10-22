package routes

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"backend/config"
	"github.com/gin-gonic/gin"
)

func TestHealthIsPublicAndDoesNotNeedDatabase(t *testing.T) {
	previousDB := config.DB
	config.DB = nil
	t.Cleanup(func() { config.DB = previousDB })

	router := gin.New()
	SetupRoutes(router)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/health", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("expected 200 without authentication or database, got %d", response.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil || body["status"] != "ok" {
		t.Fatalf("unexpected health response: %s", response.Body.String())
	}
	if response.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("health response must not be cached")
	}
}
