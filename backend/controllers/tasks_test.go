package controllers

import (
	"net/http"
	"strings"
	"testing"
)

func TestCreateTaskRejectsLegacyInvitationBeforeWriting(t *testing.T) {
	state := &accountDB{}
	useAccountDB(t, state)

	response := callAccountHandler(CreateTask, `{"title":"Private collaboration","assignee_email":"person@example.com"}`)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for unsupported invitation, got %d: %s", response.Code, response.Body.String())
	}
	if !strings.Contains(response.Body.String(), "Remove the invite address") {
		t.Fatalf("expected an actionable invitation error, got %s", response.Body.String())
	}
	if state.writes != 0 || state.committed || state.rolledBack {
		t.Fatal("unsupported invitation must be rejected before starting a transaction")
	}
}
