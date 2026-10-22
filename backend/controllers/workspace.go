package controllers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"backend/config"
	"backend/models"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
)

func generateInviteCode() string {
	bytes := make([]byte, 8)
	if _, err := rand.Read(bytes); err != nil {
		return "INVITE"
	}
	return hex.EncodeToString(bytes)
}

func CreateWorkspace(c *gin.Context) {
	var input struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Category    string `json:"category"`
	}

	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if strings.TrimSpace(input.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Workspace name is required"})
		return
	}

	userID := c.MustGet("user_id").(int64)
	inviteCode := generateInviteCode()

	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}
	defer tx.Rollback()

	var workspaceID int64
	err = tx.QueryRow(
		`INSERT INTO workspaces (name, description, type, category, owner_id, invite_code) 
		 VALUES ($1, $2, 'team', $3, $4, $5) RETURNING id`,
		input.Name, input.Description, input.Category, userID, inviteCode,
	).Scan(&workspaceID)

	if err != nil {
		fmt.Printf("Error inserting workspace: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create workspace: " + err.Error()})
		return
	}

	_, err = tx.Exec(
		`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
		workspaceID, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add workspace owner"})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": strconv.FormatInt(workspaceID, 10), "invite_code": inviteCode})
}

func ListWorkspaces(c *gin.Context) {
	userID := c.MustGet("user_id").(int64)

	query := `
		SELECT w.id, w.name, w.description, w.type, w.category, w.owner_id, w.invite_code, w.created_at, w.updated_at,
		       wm.role, u.name as owner_name,
		       (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id) as member_count
		FROM workspaces w
		JOIN workspace_members wm ON w.id = wm.workspace_id
		JOIN users u ON w.owner_id = u.id
		WHERE wm.user_id = $1
		ORDER BY w.created_at DESC
	`

	rows, err := config.DB.Query(query, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list workspaces"})
		return
	}
	defer rows.Close()

	var workspaces = []models.Workspace{}
	for rows.Next() {
		var w models.Workspace
		var role, ownerName string
		err := rows.Scan(
			&w.ID, &w.Name, &w.Description, &w.Type, &w.Category, &w.OwnerID, &w.InviteCode, &w.CreatedAt, &w.UpdatedAt,
			&role, &ownerName, &w.MemberCount,
		)
		if err != nil {
			continue
		}
		w.UserRole = models.WorkspaceRole(role)
		w.OwnerName = ownerName
		workspaces = append(workspaces, w)
	}

	c.JSON(http.StatusOK, workspaces)
}

func GetWorkspace(c *gin.Context) {
	workspaceIDStr := c.Param("id")
	workspaceID, err := strconv.ParseInt(workspaceIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	userID := c.MustGet("user_id").(int64)

	var role string
	err = config.DB.QueryRow(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, workspaceID, userID).Scan(&role)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	query := `
		SELECT w.id, w.name, w.description, w.type, w.category, w.owner_id, w.invite_code, w.created_at, w.updated_at,
		       u.name as owner_name,
		       (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id) as member_count
		FROM workspaces w
		JOIN users u ON w.owner_id = u.id
		WHERE w.id = $1
	`

	var w models.Workspace
	err = config.DB.QueryRow(query, workspaceID).Scan(
		&w.ID, &w.Name, &w.Description, &w.Type, &w.Category, &w.OwnerID, &w.InviteCode, &w.CreatedAt, &w.UpdatedAt,
		&w.OwnerName, &w.MemberCount,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	w.UserRole = models.WorkspaceRole(role)

	c.JSON(http.StatusOK, w)
}

func DeleteWorkspace(c *gin.Context) {
	workspaceIDStr := c.Param("id")
	workspaceID, err := strconv.ParseInt(workspaceIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	userID := c.MustGet("user_id").(int64)

	var role string
	err = config.DB.QueryRow(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, workspaceID, userID).Scan(&role)
	if err != nil || role != "owner" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the owner can delete the workspace"})
		return
	}

	_, err = config.DB.Exec(`DELETE FROM workspaces WHERE id = $1`, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete workspace"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Workspace deleted successfully"})
}

func InviteWorkspaceMember(c *gin.Context) {
	workspaceIDStr := c.Param("id")
	workspaceID, err := strconv.ParseInt(workspaceIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	userID := c.MustGet("user_id").(int64)

	var role string
	err = config.DB.QueryRow(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, workspaceID, userID).Scan(&role)
	if err != nil || (role != "owner" && role != "admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admins and owners can invite members"})
		return
	}

	var input struct {
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if input.Role == "" {
		input.Role = "member"
	}
	if input.Role != "admin" && input.Role != "member" && input.Role != "viewer" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
		return
	}

	var targetUserID int64
	err = config.DB.QueryRow(`SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))`, input.Email).Scan(&targetUserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User with this email not found"})
		return
	}

	var exists bool
	config.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2)`, workspaceID, targetUserID).Scan(&exists)
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "User is already a member"})
		return
	}

	_, err = config.DB.Exec(
		`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)`,
		workspaceID, targetUserID, input.Role,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Member added successfully"})
}

func ListWorkspaceMembers(c *gin.Context) {
	workspaceIDStr := c.Param("id")
	workspaceID, err := strconv.ParseInt(workspaceIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	userID := c.MustGet("user_id").(int64)

	var exists bool
	config.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2)`, workspaceID, userID).Scan(&exists)
	if !exists {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	query := `
		SELECT wm.workspace_id, wm.user_id, wm.role, wm.joined_at, u.name, u.email, COALESCE(u.photo_url, '') as photo_url
		FROM workspace_members wm
		JOIN users u ON wm.user_id = u.id
		WHERE wm.workspace_id = $1
		ORDER BY wm.joined_at ASC
	`
	rows, err := config.DB.Query(query, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch members"})
		return
	}
	defer rows.Close()

	var members = []models.WorkspaceMember{}
	for rows.Next() {
		var m models.WorkspaceMember
		var role string
		err := rows.Scan(&m.WorkspaceID, &m.UserID, &role, &m.JoinedAt, &m.Name, &m.Email, &m.PhotoURL)
		if err != nil {
			continue
		}
		m.Role = models.WorkspaceRole(role)
		members = append(members, m)
	}

	c.JSON(http.StatusOK, members)
}

func CreateWorkspaceTask(c *gin.Context) {
	workspaceIDStr := c.Param("id")
	workspaceID, err := strconv.ParseInt(workspaceIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	userID := c.MustGet("user_id").(int64)

	var role string
	err = config.DB.QueryRow(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, workspaceID, userID).Scan(&role)
	if err != nil || role == "viewer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have permission to create tasks in this workspace"})
		return
	}

	var input struct {
		Title         string   `json:"title"`
		Description   string   `json:"description"`
		Subject       string   `json:"subject"`
		Priority      string   `json:"priority"`
		AssigneeEmail string   `json:"assignee_email"`
		MilestoneID   *int64   `json:"milestone_id"`
		DueDate       *string  `json:"deadline"`
		IssueType     string   `json:"issue_type"`
		Labels        []string `json:"labels"`
		AttachmentURL string   `json:"attachment_url"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if strings.TrimSpace(input.Title) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Title is required"})
		return
	}

	var assigneeID *int64
	if input.AssigneeEmail != "" {
		var aID int64
		err = config.DB.QueryRow(`SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))`, input.AssigneeEmail).Scan(&aID)
		if err == nil {
			var isMember bool
			config.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2)`, workspaceID, aID).Scan(&isMember)
			if isMember {
				assigneeID = &aID
			}
		}
	}

	var taskID int64
	err = config.DB.QueryRow(
		`INSERT INTO workspace_tasks (workspace_id, title, description, status, priority, creator_id, assignee_id, milestone_id, due_date, subject, attachment_url, issue_type, labels)
		 VALUES ($1, $2, $3, 'pending', COALESCE(NULLIF($4, ''), 'Medium'), $5, $6, $7, $8, $9, $10, COALESCE(NULLIF($11, ''), 'Task'), $12) RETURNING id`,
		workspaceID, input.Title, input.Description, input.Priority, userID, assigneeID, input.MilestoneID, input.DueDate, input.Subject, input.AttachmentURL, input.IssueType, pq.Array(input.Labels),
	).Scan(&taskID)

	if err != nil {
		fmt.Printf("CreateWorkspaceTask error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
		return
	}

	// Log activity
	_, _ = config.DB.Exec(
		`INSERT INTO workspace_activities (workspace_id, user_id, action, details, entity_type, entity_id)
		 VALUES ($1, $2, 'task_created', 'Created task', 'task', $3)`,
		workspaceID, userID, taskID,
	)

	c.JSON(http.StatusCreated, gin.H{"id": strconv.FormatInt(taskID, 10)})
}

func ListWorkspaceTasks(c *gin.Context) {
	workspaceIDStr := c.Param("id")
	workspaceID, err := strconv.ParseInt(workspaceIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	userID := c.MustGet("user_id").(int64)

	var exists bool
	config.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2)`, workspaceID, userID).Scan(&exists)
	if !exists {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	query := `
		SELECT t.id, t.workspace_id, t.title, t.description, t.status, t.priority, t.creator_id, t.assignee_id, t.milestone_id, t.due_date, t.created_at, t.updated_at,
		       COALESCE(c.name, 'Former member') as creator_name, COALESCE(c.photo_url, '') as creator_photo_url,
		       a.name as assignee_name, COALESCE(a.email, '') as assignee_email, COALESCE(a.photo_url, '') as assignee_photo_url,
		       COALESCE(m.title, '') as milestone_title,
		       COALESCE(t.subject, ''), COALESCE(t.attachment_url, ''), COALESCE(t.issue_type, 'Task'), t.labels
		FROM workspace_tasks t
		LEFT JOIN users c ON t.creator_id = c.id
		LEFT JOIN users a ON t.assignee_id = a.id
		LEFT JOIN workspace_milestones m ON t.milestone_id = m.id
		WHERE t.workspace_id = $1
		ORDER BY t.created_at DESC
	`

	rows, err := config.DB.Query(query, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tasks"})
		return
	}
	defer rows.Close()

	var tasks = []models.WorkspaceTask{}
	for rows.Next() {
		var t models.WorkspaceTask
		var aName, aEmail, aPhoto, mTitle sql.NullString
		err := rows.Scan(
			&t.ID, &t.WorkspaceID, &t.Title, &t.Description, &t.Status, &t.Priority, &t.CreatorID, &t.AssigneeID, &t.MilestoneID, &t.DueDate, &t.CreatedAt, &t.UpdatedAt,
			&t.CreatorName, &t.CreatorPhotoURL,
			&aName, &aEmail, &aPhoto, &mTitle,
			&t.Subject, &t.AttachmentURL, &t.IssueType, pq.Array(&t.Labels),
		)
		if err != nil {
			continue
		}
		t.AssigneeName = aName.String
		t.AssigneeEmail = aEmail.String
		t.AssigneePhotoURL = aPhoto.String
		t.MilestoneTitle = mTitle.String
		tasks = append(tasks, t)
	}

	c.JSON(http.StatusOK, tasks)
}

func UpdateWorkspaceTaskStatus(c *gin.Context) {
	workspaceIDStr := c.Param("id")
	workspaceID, err := strconv.ParseInt(workspaceIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	taskIDStr := c.Param("taskId")
	taskID, err := strconv.ParseInt(taskIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	userID := c.MustGet("user_id").(int64)

	var role string
	err = config.DB.QueryRow(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, workspaceID, userID).Scan(&role)
	if err != nil || role == "viewer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var input struct {
		Status string `json:"status"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	_, err = config.DB.Exec(`UPDATE workspace_tasks SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND workspace_id = $3`, input.Status, taskID, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update task status"})
		return
	}

	_, _ = config.DB.Exec(
		`INSERT INTO workspace_activities (workspace_id, user_id, action, details, entity_type, entity_id)
		 VALUES ($1, $2, 'task_updated', 'Updated task status to ' || $3, 'task', $4)`,
		workspaceID, userID, input.Status, taskID,
	)

	c.JSON(http.StatusOK, gin.H{"message": "Task status updated"})
}

func CreateWorkspaceMilestone(c *gin.Context) {
	workspaceIDStr := c.Param("id")
	workspaceID, err := strconv.ParseInt(workspaceIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	userID := c.MustGet("user_id").(int64)

	var role string
	err = config.DB.QueryRow(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, workspaceID, userID).Scan(&role)
	if err != nil || role == "viewer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var input struct {
		Title       string  `json:"title"`
		Description string  `json:"description"`
		DueDate     *string `json:"due_date"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	var milestoneID int64
	err = config.DB.QueryRow(
		`INSERT INTO workspace_milestones (workspace_id, title, description, due_date) VALUES ($1, $2, $3, $4) RETURNING id`,
		workspaceID, input.Title, input.Description, input.DueDate,
	).Scan(&milestoneID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create milestone"})
		return
	}

	_, _ = config.DB.Exec(
		`INSERT INTO workspace_activities (workspace_id, user_id, action, details, entity_type, entity_id)
		 VALUES ($1, $2, 'milestone_created', 'Created milestone', 'milestone', $3)`,
		workspaceID, userID, milestoneID,
	)

	c.JSON(http.StatusCreated, gin.H{"id": strconv.FormatInt(milestoneID, 10)})
}

func ListWorkspaceMilestones(c *gin.Context) {
	workspaceIDStr := c.Param("id")
	workspaceID, err := strconv.ParseInt(workspaceIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	userID := c.MustGet("user_id").(int64)

	var exists bool
	config.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2)`, workspaceID, userID).Scan(&exists)
	if !exists {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	query := `
		SELECT m.id, m.workspace_id, m.title, m.description, m.due_date, m.created_at, m.updated_at,
		       (SELECT COUNT(*) FROM workspace_tasks WHERE milestone_id = m.id) as total_tasks,
		       (SELECT COUNT(*) FROM workspace_tasks WHERE milestone_id = m.id AND status = 'done') as completed_tasks
		FROM workspace_milestones m
		WHERE m.workspace_id = $1
		ORDER BY m.due_date ASC NULLS LAST, m.created_at DESC
	`

	rows, err := config.DB.Query(query, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch milestones"})
		return
	}
	defer rows.Close()

	var milestones = []models.WorkspaceMilestone{}
	for rows.Next() {
		var m models.WorkspaceMilestone
		err := rows.Scan(
			&m.ID, &m.WorkspaceID, &m.Title, &m.Description, &m.DueDate, &m.CreatedAt, &m.UpdatedAt,
			&m.TotalTasks, &m.CompletedTasks,
		)
		if err == nil {
			if m.TotalTasks > 0 {
				m.Progress = float64(m.CompletedTasks) / float64(m.TotalTasks) * 100
			} else {
				m.Progress = 0
			}
			milestones = append(milestones, m)
		}
	}

	c.JSON(http.StatusOK, milestones)
}

func ListWorkspaceActivities(c *gin.Context) {
	workspaceIDStr := c.Param("id")
	workspaceID, err := strconv.ParseInt(workspaceIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	userID := c.MustGet("user_id").(int64)

	var exists bool
	config.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2)`, workspaceID, userID).Scan(&exists)
	if !exists {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	query := `
		SELECT a.id, a.workspace_id, a.user_id, a.action, a.details, a.entity_type, a.entity_id, a.created_at,
		       COALESCE(u.name, 'System') as user_name, COALESCE(u.photo_url, '') as user_photo_url,
		       CASE 
		         WHEN a.entity_type = 'task' THEN COALESCE((SELECT title FROM workspace_tasks WHERE id = a.entity_id), 'Unknown Task')
		         WHEN a.entity_type = 'milestone' THEN COALESCE((SELECT title FROM workspace_milestones WHERE id = a.entity_id), 'Unknown Milestone')
		         ELSE ''
		       END as entity_title
		FROM workspace_activities a
		LEFT JOIN users u ON a.user_id = u.id
		WHERE a.workspace_id = $1
		ORDER BY a.created_at DESC
		LIMIT 50
	`

	rows, err := config.DB.Query(query, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch activities"})
		return
	}
	defer rows.Close()

	var activities = []models.WorkspaceActivity{}
	for rows.Next() {
		var a models.WorkspaceActivity
		err := rows.Scan(
			&a.ID, &a.WorkspaceID, &a.UserID, &a.Action, &a.Details, &a.EntityType, &a.EntityID, &a.CreatedAt,
			&a.UserName, &a.UserPhotoURL, &a.EntityTitle,
		)
		if err == nil {
			activities = append(activities, a)
		}
	}

	c.JSON(http.StatusOK, activities)
}
func JoinWorkspaceByCode(c *gin.Context) {
	inviteCode := c.Param("code")
	userID := c.MustGet("user_id").(int64)

	var workspaceID int64
	err := config.DB.QueryRow(`SELECT id FROM workspaces WHERE invite_code = $1`, inviteCode).Scan(&workspaceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invalid invite code"})
		return
	}

	var exists bool
	config.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2)`, workspaceID, userID).Scan(&exists)
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "You are already a member of this workspace"})
		return
	}

	_, err = config.DB.Exec(
		`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'member')`,
		workspaceID, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join workspace"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Joined workspace successfully", "workspace_id": strconv.FormatInt(workspaceID, 10)})
}
func RemoveWorkspaceMember(c *gin.Context) {
	workspaceIDStr := c.Param("id")
	workspaceID, err := strconv.ParseInt(workspaceIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	targetUserIDStr := c.Param("userId")
	targetUserID, err := strconv.ParseInt(targetUserIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	currentUserID := c.MustGet("user_id").(int64)

	var currentUserRole string
	err = config.DB.QueryRow(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, workspaceID, currentUserID).Scan(&currentUserRole)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var targetUserRole string
	err = config.DB.QueryRow(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, workspaceID, targetUserID).Scan(&targetUserRole)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found in this workspace"})
		return
	}

	switch currentUserRole {
	case "owner":
		if currentUserID == targetUserID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Owner cannot remove themselves"})
			return
		}
	case "admin":
		if targetUserRole != "member" && targetUserRole != "viewer" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admins can only remove members and viewers"})
			return
		}
	default:
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have permission to remove this member"})
		return
	}

	_, err = config.DB.Exec(`DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, workspaceID, targetUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Member removed successfully"})
}
