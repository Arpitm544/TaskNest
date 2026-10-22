package controllers

import (
	"github.com/gin-gonic/gin"
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

func TestWorkspaceTasksWithDeletedCreatorsUseNormalAuthorization(t *testing.T) {
	cases := []struct {
		name    string
		handler gin.HandlerFunc
		body    string
		status  int
	}{
		{"status", UpdateTaskStatus, `{"status":"in_progress"}`, 200},
		{"edit", UpdateTask, `{"title":"Updated"}`, 403},
		{"assign", AssignMilestone, `{"assignee_id":"42"}`, 200},
		{"reorder", ReorderMilestones, `{"milestone_ids":[]}`, 200},
		{"delete-milestone", DeleteMilestone, `{}`, 200},
		{"generate", GenerateMilestones, `{"task_id":"1"}`, 403},
	}
	for _, role := range []string{"owner", "admin", "member", ""} {
		for _, tc := range cases {
			t.Run(tc.name+"/"+role, func(t *testing.T) {
				state := &accountDB{orphanWorkspaceTask: true, workspaceRole: role}
				useAccountDB(t, state)
				response := callAccountHandler(func(c *gin.Context) {
					c.Params = gin.Params{{Key: "id", Value: "1"}, {Key: "mid", Value: "2"}}
					tc.handler(c)
				}, tc.body)
				expected := tc.status
				if (role == "member" && tc.name != "status") || role == "" {
					expected = 403
				}
				if response.Code != expected {
					t.Fatalf("got %d, want %d: %s", response.Code, expected, response.Body)
				}
			})
		}
	}
}
