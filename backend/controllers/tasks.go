package controllers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"backend/config"
	"backend/models"
	"backend/services"
	"github.com/lib/pq"

	"github.com/gin-gonic/gin"
)

func CreateTask(c *gin.Context) {
	var input struct {
		Title         string   `json:"title"`
		Description   string   `json:"description"`
		Subject       string   `json:"subject"`
		Deadline      *string  `json:"deadline"`
		AttachmentURL *string  `json:"attachment_url"`
		Capacity      int      `json:"capacity"`
		MaxAssignees  int      `json:"max_assignees"`
		Priority      string   `json:"priority"`
		IssueType     string   `json:"issue_type"`
		Labels        []string `json:"labels"`
		AiOptimized   bool     `json:"ai_optimized"`
		AssigneeEmail string   `json:"assignee_email"`
	}

	if c.BindJSON(&input) != nil || strings.TrimSpace(input.Title) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	// Reject legacy invitation requests rather than silently publishing the task.
	if strings.TrimSpace(input.AssigneeEmail) != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Inviting a person during task creation is no longer supported. Remove the invite address to post this task."})
		return
	}

	cap := input.Capacity
	if cap < 1 {
		cap = input.MaxAssignees
	}
	if cap < 1 {
		cap = 1
	}

	userID := c.MustGet("user_id").(int64)

	// Start transaction
	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}
	defer tx.Rollback()

	var id int64
	err = tx.QueryRow(
		`INSERT INTO tasks (title, description, status, accepted, creator_id, deadline, progress, subject, attachment_url, capacity, priority, ai_optimized, issue_type, labels)
		 VALUES ($1,$2,'pending',FALSE,$3,$4,0,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
		input.Title, input.Description, userID, input.Deadline, input.Subject, input.AttachmentURL, cap, input.Priority, input.AiOptimized, input.IssueType, pq.Array(input.Labels),
	).Scan(&id)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
		return
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		fmt.Printf("Critical Error: Transaction commit failed for task %d: %v\n", id, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save task"})
		return
	}

	fmt.Printf("EXPOSED NEW TASK ID: %d\n", id)
	services.LogActivity(id, userID, "created", "Task created")
	c.JSON(http.StatusCreated, gin.H{"id": strconv.FormatInt(id, 10)})

}

func UpdateTask(c *gin.Context) {
	taskID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	userID := c.MustGet("user_id").(int64)

	var creatorID sql.NullInt64
	err := config.DB.QueryRow("SELECT creator_id FROM tasks WHERE id = $1", taskID).Scan(&creatorID)
	if err != nil {
		// Try workspace_tasks if not in tasks table
		err = config.DB.QueryRow("SELECT creator_id FROM workspace_tasks WHERE id = $1", taskID).Scan(&creatorID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
			return
		}
	}

	if !creatorID.Valid || creatorID.Int64 != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized"})
		return
	}

	var input struct {
		Title         string   `json:"title"`
		Description   string   `json:"description"`
		Subject       string   `json:"subject"`
		Deadline      *string  `json:"deadline"`
		AttachmentURL *string  `json:"attachment_url"`
		Capacity      int      `json:"capacity"`
		MaxAssignees  int      `json:"max_assignees"`
		Priority      string   `json:"priority"`
		IssueType     string   `json:"issue_type"`
		Labels        []string `json:"labels"`
		AiOptimized   bool     `json:"ai_optimized"`
	}

	if c.BindJSON(&input) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	cap := input.Capacity
	if cap < 1 {
		cap = input.MaxAssignees
	}
	if cap < 1 {
		cap = 1
	}

	res, err := config.DB.Exec(
		`UPDATE tasks 
		 SET title = $1, description = $2, subject = $3, deadline = $4, attachment_url = $5, 
		     capacity = $6, priority = $7, ai_optimized = $8, issue_type = $9, labels = $10, extension_email_sent = FALSE, updated_at = CURRENT_TIMESTAMP 
		 WHERE id = $11`,
		input.Title, input.Description, input.Subject, input.Deadline, input.AttachmentURL, cap, input.Priority, input.AiOptimized, input.IssueType, pq.Array(input.Labels), taskID,
	)

	if err == nil {
		rows, _ := res.RowsAffected()
		if rows == 0 {
			// Try workspace_tasks
			resW, errW := config.DB.Exec(
				`UPDATE workspace_tasks 
				 SET title = $1, description = $2, subject = $3, due_date = $4, attachment_url = $5, 
				     priority = $6, issue_type = $7, labels = $8, updated_at = CURRENT_TIMESTAMP 
				 WHERE id = $9`,
				input.Title, input.Description, input.Subject, input.Deadline, input.AttachmentURL, input.Priority, input.IssueType, pq.Array(input.Labels), taskID,
			)
			if errW != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update workspace task"})
				return
			}
			rowsW, _ := resW.RowsAffected()
			if rowsW == 0 {
				c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
				return
			}
		}
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update task"})
		return
	}

	services.LogActivity(taskID, userID, "task_updated", "Task details updated")
	c.JSON(http.StatusOK, gin.H{"message": "Task updated successfully"})
}

func ListTasks(c *gin.Context) {
	userID := c.MustGet("user_id").(int64)
	search := c.Query("search")

	query := `SELECT t.id, t.title, t.description, t.status, t.accepted, t.creator_id, t.assignee_id, t.deadline, t.progress, t.subject, t.attachment_url, t.created_at, t.updated_at,
	          u_a.name as assignee_name, u_a.photo_url as assignee_photo_url, u_c.name as creator_name, u_c.photo_url as creator_photo_url, t.priority, t.ai_optimized, COALESCE(t.capacity, 1) as capacity,
	          t.issue_type, t.labels
	          FROM tasks t LEFT JOIN users u_a ON t.assignee_id = u_a.id LEFT JOIN users u_c ON t.creator_id = u_c.id
	          WHERE t.creator_id <> $1
	            AND (SELECT COUNT(*) FROM task_assignees ta WHERE ta.task_id = t.id) < COALESCE(t.capacity, 1)
	            AND NOT EXISTS (SELECT 1 FROM task_assignees ta2 WHERE ta2.task_id = t.id AND ta2.user_id = $2)
	            AND NOT EXISTS (SELECT 1 FROM task_invitations ti WHERE ti.task_id = t.id AND ti.status = 'pending')`

	var tasks []models.Task
	var err error

	if search != "" {
		query += ` AND (t.title ILIKE $3 OR t.description ILIKE $3 OR t.subject ILIKE $3)`
		tasks, err = services.FetchTasksByQuery(query, userID, userID, "%"+search+"%")
	} else {
		query += ` ORDER BY t.id DESC`
		tasks, err = services.FetchTasksByQuery(query, userID, userID)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list tasks"})
		return
	}
	fmt.Printf("EXPOSED MARKET TASK COUNT: %d\n", len(tasks))
	c.JSON(http.StatusOK, tasks)
}

func ListDashboardTasks(c *gin.Context) {
	userID := c.MustGet("user_id").(int64)
	query := `SELECT t.id, t.title, t.description, t.status, t.accepted, t.creator_id, t.assignee_id, t.deadline, t.progress, t.subject, t.attachment_url, t.created_at, t.updated_at,
	          u_a.name as assignee_name, u_a.photo_url as assignee_photo_url, u_c.name as creator_name, u_c.photo_url as creator_photo_url, t.priority, t.ai_optimized, COALESCE(t.capacity, 1) as capacity,
	          t.issue_type, t.labels
	          FROM tasks t LEFT JOIN users u_a ON t.assignee_id = u_a.id LEFT JOIN users u_c ON t.creator_id = u_c.id
	          WHERE t.creator_id = $1
	             OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $2)
	          ORDER BY t.id DESC`

	tasks, err := services.FetchTasksByQuery(query, userID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch dashboard"})
		return
	}
	fmt.Printf("EXPOSED DASHBOARD TASK COUNT: %d\n", len(tasks))
	c.JSON(http.StatusOK, tasks)
}

func AcceptTask(c *gin.Context) {
	taskID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	userID := c.MustGet("user_id").(int64)

	var creatorID sql.NullInt64
	var title string
	var capacity int
	err := config.DB.QueryRow(
		`SELECT creator_id, title, COALESCE(capacity, 1) FROM tasks WHERE id = $1`, taskID,
	).Scan(&creatorID, &title, &capacity)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	if creatorID.Valid && creatorID.Int64 == userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You cannot accept your own assignment"})
		return
	}

	var exists bool
	config.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM task_assignees WHERE task_id=$1 AND user_id=$2)`, taskID, userID,
	).Scan(&exists)
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "You have already accepted this assignment"})
		return
	}

	var currentCount int
	config.DB.QueryRow(
		`SELECT COUNT(*) FROM task_assignees WHERE task_id=$1`, taskID,
	).Scan(&currentCount)
	if currentCount >= capacity {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No slots available — this assignment is full"})
		return
	}
	_, err = config.DB.Exec(
		`INSERT INTO task_assignees (task_id, user_id, status) VALUES ($1, $2, 'accepted')`, taskID, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to accept task"})
		return
	}
	config.DB.Exec(
		`UPDATE tasks SET accepted = TRUE, assignee_id = COALESCE(assignee_id, $1), status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
		userID, taskID,
	)

	services.LogActivity(taskID, userID, "accepted", "Member joined the task")
	c.JSON(http.StatusOK, gin.H{"message": "Assignment accepted"})

}

func GetTask(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		fmt.Printf("Error: Malformed task ID in URL [%s]: %v\n", idStr, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	fmt.Printf("Fetching details for Task ID: %d (parsed from %s)\n", id, idStr)
	userID := c.MustGet("user_id").(int64)

	var t models.Task
	var desc, subj, attach, subL sql.NullString
	var cn, ce, cp, an, ae, ap, priority sql.NullString
	var cid, aid sql.NullInt64
	var aiOptimized sql.NullBool
	var aiMilestoneCount sql.NullInt64
	var issueType sql.NullString
	var labels []string

	// Try regular tasks first
	query := `SELECT t.id, t.title, t.description, t.status, t.accepted, t.creator_id, t.assignee_id, t.deadline, t.progress, t.subject, t.attachment_url, 
	          t.submission_github as submission_link, COALESCE(t.capacity, 1), t.created_at, t.updated_at,
	          u_c.name, u_c.email, u_c.photo_url, u_a.name, u_a.email, u_a.photo_url, t.priority, t.ai_optimized, t.ai_milestone_count,
	          t.issue_type, t.labels
	          FROM tasks t LEFT JOIN users u_c ON t.creator_id = u_c.id LEFT JOIN users u_a ON t.assignee_id = u_a.id WHERE t.id = $1`

	err = config.DB.QueryRow(query, id).Scan(
		&t.ID, &t.Title, &desc, &t.Status, &t.Accepted, &cid, &aid, &t.Deadline, &t.Progress, &subj, &attach,
		&subL, &t.Capacity, &t.CreatedAt, &t.UpdatedAt,
		&cn, &ce, &cp, &an, &ae, &ap, &priority, &aiOptimized, &aiMilestoneCount,
		&issueType, pq.Array(&labels),
	)

	if err != nil {
		// If not found in tasks, try workspace_tasks
		fmt.Printf("Task %d not found in tasks table, trying workspace_tasks...\n", id)

		workspaceQuery := `SELECT t.id, t.title, t.description, t.status, t.creator_id, t.assignee_id, t.due_date as deadline, t.priority, t.created_at, t.updated_at,
		                  u_c.name, u_c.email, u_c.photo_url, u_a.name, u_a.email, u_a.photo_url, t.subject, t.attachment_url, t.issue_type, t.labels, t.workspace_id
		                  FROM workspace_tasks t LEFT JOIN users u_c ON t.creator_id = u_c.id LEFT JOIN users u_a ON t.assignee_id = u_a.id WHERE t.id = $1`

		var wid sql.NullInt64
		err = config.DB.QueryRow(workspaceQuery, id).Scan(
			&t.ID, &t.Title, &desc, &t.Status, &cid, &aid, &t.Deadline, &priority, &t.CreatedAt, &t.UpdatedAt,
			&cn, &ce, &cp, &an, &ae, &ap, &subj, &attach, &issueType, pq.Array(&labels), &wid,
		)

		if err != nil {
			fmt.Printf("GetTask error for ID %d (workspace_tasks check): %v\n", id, err)
			c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
			return
		}

		if wid.Valid {
			t.WorkspaceID = &wid.Int64
			// Fetch user role in workspace
			var role string
			errR := config.DB.QueryRow(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, wid.Int64, userID).Scan(&role)
			if errR == nil {
				t.UserRole = role
			}
		}

		// Map workspace specific logic
		t.Accepted = true // Workspace tasks are considered accepted by default if they exist
		t.Capacity = 1
		t.Progress = 0
		if t.Status == "done" || t.Status == "completed" {
			t.Progress = 100
		}
	}

	if aiMilestoneCount.Valid {
		t.AiMilestoneCount = int(aiMilestoneCount.Int64)
	}

	t.Priority = priority.String
	t.IssueType = issueType.String
	t.Labels = labels
	if t.IssueType == "" {
		t.IssueType = "Task"
	}
	if t.Labels == nil {
		t.Labels = []string{}
	}
	t.AiOptimized = aiOptimized.Bool

	t.Description = desc.String
	t.Subject = subj.String
	if attach.Valid {
		t.AttachmentURL = &attach.String
	}
	t.CreatorName, t.CreatorEmail, t.CreatorPhotoURL = cn.String, ce.String, cp.String
	t.AssigneeName, t.AssigneeEmail, t.AssigneePhotoURL = an.String, ae.String, ap.String
	if subL.Valid {
		t.SubmissionLink = &subL.String
	}

	if cid.Valid {
		t.CreatorID = &cid.Int64
	}
	if aid.Valid {
		t.AssigneeID = &aid.Int64
	}

	t.Assignees = make([]models.TaskAssignee, 0)
	// If it was a workspace task, the creator and assignee are essentially the "assignees" list for TaskDetail
	if aid.Valid {
		t.Assignees = append(t.Assignees, models.TaskAssignee{
			TaskID:   t.ID,
			UserID:   aid.Int64,
			Status:   t.Status,
			Name:     an.String,
			Email:    ae.String,
			PhotoURL: ap.String,
		})
	}

	t.SlotsFilled = len(t.Assignees)

	isCreator := cid.Valid && cid.Int64 == userID
	isAssignee := false
	for _, a := range t.Assignees {
		if a.UserID == userID {
			isAssignee = true
			break
		}
	}

	if !isCreator && !isAssignee {
		fmt.Printf("User %d is viewing Task %d as a guest/manager\n", userID, id)
	}
	mRows, _ := config.DB.Query(`
		SELECT m.id, m.title, m.status, m.submission_link, m.submission_note, m.assignee_id, m.position, m.created_at, m.updated_at,
		       u.name as assignee_name, u.photo_url as assignee_photo_url
		FROM milestones m
		LEFT JOIN users u ON m.assignee_id = u.id
		WHERE m.task_id = $1 
		ORDER BY m.position ASC, m.id ASC`, id)
	if mRows != nil {
		defer mRows.Close()
		for mRows.Next() {
			var m models.Milestone
			var sl, sn sql.NullString
			var aid sql.NullInt64
			var an, ap sql.NullString
			mRows.Scan(&m.ID, &m.Title, &m.Status, &sl, &sn, &aid, &m.Position, &m.CreatedAt, &m.UpdatedAt, &an, &ap)
			if sl.Valid {
				m.SubmissionLink = &sl.String
			}
			if sn.Valid {
				m.SubmissionNote = &sn.String
			}
			if aid.Valid {
				m.AssigneeID = &aid.Int64
			}
			m.AssigneeName = an.String
			m.AssigneePhotoURL = ap.String
			t.Milestones = append(t.Milestones, m)
		}
	}

	t.Activities, _ = services.FetchActivities(id)
	if t.Activities == nil {
		t.Activities = make([]models.Activity, 0)
	}

	t.Links, _ = services.FetchTaskLinks(id)
	if t.Links == nil {
		t.Links = make([]models.TaskLink, 0)
	}

	c.JSON(http.StatusOK, t)
}

func InviteUser(c *gin.Context) {
	taskID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	userID := c.MustGet("user_id").(int64)

	var input struct {
		Email string `json:"email"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid email"})
		return
	}

	var creatorID sql.NullInt64
	var taskTitle string
	err := config.DB.QueryRow(`SELECT creator_id, title FROM tasks WHERE id = $1`, taskID).Scan(&creatorID, &taskTitle)
	if err != nil || (!creatorID.Valid || creatorID.Int64 != userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only creators can invite users"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(input.Email))
	_, err = config.DB.Exec(`INSERT INTO task_invitations (task_id, invitee_email, status, created_at) VALUES ($1, $2, 'pending', CURRENT_TIMESTAMP)`, taskID, email)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Invitation already sent to this user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Invitation sent successfully"})
}

func ListInvitations(c *gin.Context) {
	userEmail := c.GetString("user_email")

	if userEmail == "" {
		userID := c.MustGet("user_id").(int64)
		err := config.DB.QueryRow(`SELECT email FROM users WHERE id = $1`, userID).Scan(&userEmail)
		if err != nil {
			fmt.Printf("Error fetching user email for ID %d: %v\n", userID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to identify user email"})
			return
		}
	}

	cleanEmail := strings.TrimSpace(userEmail)
	fmt.Printf("Fetching invitations for user ID %d with email: [%s]\n", c.MustGet("user_id").(int64), cleanEmail)

	query := `
		SELECT i.id, i.task_id, i.invitee_email, i.status, i.created_at, t.title, t.description, t.subject, t.deadline, u.name
		FROM task_invitations i
		INNER JOIN tasks t ON i.task_id = t.id
		LEFT JOIN users u ON t.creator_id = u.id
		WHERE LOWER(TRIM(i.invitee_email)) = LOWER(TRIM($1)) AND i.status = 'pending'
		ORDER BY i.created_at DESC`
	rows, err := config.DB.Query(query, cleanEmail)

	if err != nil {
		fmt.Printf("Database error fetching invitations: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch invitations"})
		return
	}
	defer rows.Close()

	invitations := make([]models.TaskInvitation, 0)
	for rows.Next() {
		var inv models.TaskInvitation
		var creatorName sql.NullString
		var desc, subj sql.NullString
		err := rows.Scan(&inv.ID, &inv.TaskID, &inv.InviteeEmail, &inv.Status, &inv.CreatedAt, &inv.TaskTitle, &desc, &subj, &inv.TaskDeadline, &creatorName)
		if err != nil {
			fmt.Printf("Scan error in ListInvitations: %v\n", err)
			continue
		}
		inv.CreatorName = creatorName.String
		inv.TaskDescription = desc.String
		inv.TaskSubject = subj.String
		fmt.Printf("Found Valid Invitation: ID=%d, TaskID=%d, Title=%s\n", inv.ID, inv.TaskID, inv.TaskTitle)
		invitations = append(invitations, inv)
	}

	fmt.Printf("Found %d invitations for %s\n", len(invitations), cleanEmail)
	c.JSON(http.StatusOK, invitations)
}

func RespondToInvitation(c *gin.Context) {
	invitationID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	userID := c.MustGet("user_id").(int64)
	userEmail := c.GetString("user_email")
	if userEmail == "" {
		err := config.DB.QueryRow(`SELECT email FROM users WHERE id = $1`, userID).Scan(&userEmail)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to identify user"})
			return
		}
	}

	var input struct {
		Action string `json:"action"`
	}
	c.BindJSON(&input)

	var taskID int64
	var inviteeEmail string
	err := config.DB.QueryRow(`SELECT task_id, invitee_email FROM task_invitations WHERE id = $1`, invitationID).Scan(&taskID, &inviteeEmail)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invitation not found"})
		return
	}

	if !strings.EqualFold(strings.TrimSpace(inviteeEmail), strings.TrimSpace(userEmail)) {
		fmt.Printf("Unauthorized response attempt: invitee=%s, loggedIn=%s\n", inviteeEmail, userEmail)
		c.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized"})
		return
	}

	if input.Action == "reject" {
		config.DB.Exec(`UPDATE task_invitations SET status = 'rejected' WHERE id = $1`, invitationID)
		c.JSON(http.StatusOK, gin.H{"message": "Invitation rejected"})
		return
	}

	tx, _ := config.DB.Begin()

	tx.Exec(`INSERT INTO task_assignees (task_id, user_id, status) VALUES ($1, $2, 'accepted') ON CONFLICT DO NOTHING`, taskID, userID)
	tx.Exec(`UPDATE tasks SET accepted = TRUE, assignee_id = COALESCE(assignee_id, $1), status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = $2`, userID, taskID)
	tx.Exec(`UPDATE task_invitations SET status = 'accepted' WHERE id = $1`, invitationID)

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{"message": "Invitation accepted"})
}

func AddMilestone(c *gin.Context) {
	taskID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	userID := c.MustGet("user_id").(int64)
	var input struct {
		Title string `json:"title"`
	}
	c.BindJSON(&input)

	var maxPos int
	config.DB.QueryRow("SELECT COALESCE(MAX(position), 0) FROM milestones WHERE task_id = $1", taskID).Scan(&maxPos)

	config.DB.Exec(`INSERT INTO milestones (task_id, title, status, position) VALUES ($1, $2, 'pending', $3)`, taskID, input.Title, maxPos+1)
	services.SyncTaskStatusWithMilestones(int64(taskID))
	services.LogActivity(int64(taskID), userID, "milestone_added", fmt.Sprintf("Added milestone: %s", input.Title))
	c.JSON(http.StatusCreated, gin.H{"message": "Milestone added"})
}

func UpdateMilestoneStatus(c *gin.Context) {
	taskID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	userID := c.MustGet("user_id").(int64)
	mid, _ := strconv.Atoi(c.Param("mid"))
	var input struct {
		Status string `json:"status"`
	}
	c.BindJSON(&input)

	config.DB.Exec(`UPDATE milestones SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND task_id = $3`, strings.ToLower(input.Status), mid, taskID)
	services.SyncTaskStatusWithMilestones(int64(taskID))
	services.LogActivity(int64(taskID), userID, "milestone_updated", fmt.Sprintf("Milestone status updated to %s", input.Status))
	c.JSON(http.StatusOK, gin.H{"message": "Milestone updated"})
}

func SubmitMilestoneForReview(c *gin.Context) {
	taskID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	userID := c.MustGet("user_id").(int64)
	mid, _ := strconv.Atoi(c.Param("mid"))
	var input struct {
		Link string `json:"link"`
		Note string `json:"note"`
	}
	c.BindJSON(&input)

	config.DB.Exec(`UPDATE milestones SET status = 'submitted', submission_link = $1, submission_note = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND task_id = $4`, input.Link, input.Note, mid, taskID)
	services.SyncTaskStatusWithMilestones(int64(taskID))
	services.LogActivity(taskID, userID, "milestone_submitted", "Milestone work submitted for review")
	c.JSON(http.StatusOK, gin.H{"message": "Milestone submitted"})
}

func AssignMilestone(c *gin.Context) {
	taskID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	mid, _ := strconv.ParseInt(c.Param("mid"), 10, 64)
	userID := c.MustGet("user_id").(int64)

	var input struct {
		AssigneeID int64 `json:"assignee_id,string"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	var creatorID sql.NullInt64
	var workspaceID sql.NullInt64
	err := config.DB.QueryRow("SELECT creator_id FROM tasks WHERE id = $1", taskID).Scan(&creatorID)
	if err != nil {
		err = config.DB.QueryRow("SELECT creator_id, workspace_id FROM workspace_tasks WHERE id = $1", taskID).Scan(&creatorID, &workspaceID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
			return
		}
	}

	isAuthorized := (creatorID.Valid && creatorID.Int64 == userID)
	if !isAuthorized && workspaceID.Valid {
		var role string
		err = config.DB.QueryRow(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, workspaceID.Int64, userID).Scan(&role)
		if err == nil && (role == "owner" || role == "admin") {
			isAuthorized = true
		}
	}

	if !isAuthorized {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admins, owners, or creators can assign milestones"})
		return
	}

	_, err = config.DB.Exec(`UPDATE milestones SET assignee_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND task_id = $3`, input.AssigneeID, mid, taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign milestone"})
		return
	}

	var assigneeName string
	config.DB.QueryRow("SELECT name FROM users WHERE id = $1", input.AssigneeID).Scan(&assigneeName)

	services.LogActivity(taskID, userID, "milestone_assigned", fmt.Sprintf("Assigned milestone to %s", assigneeName))
	c.JSON(http.StatusOK, gin.H{"message": "Milestone assigned successfully"})
}

func ReorderMilestones(c *gin.Context) {
	taskID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	userID := c.MustGet("user_id").(int64)

	var input struct {
		MilestoneIDs []int64 `json:"milestone_ids"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	var creatorID sql.NullInt64
	var workspaceID sql.NullInt64
	err := config.DB.QueryRow("SELECT creator_id FROM tasks WHERE id = $1", taskID).Scan(&creatorID)
	if err != nil {
		err = config.DB.QueryRow("SELECT creator_id, workspace_id FROM workspace_tasks WHERE id = $1", taskID).Scan(&creatorID, &workspaceID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
			return
		}
	}

	isAuthorized := (creatorID.Valid && creatorID.Int64 == userID)
	if !isAuthorized && workspaceID.Valid {
		var role string
		err = config.DB.QueryRow(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, workspaceID.Int64, userID).Scan(&role)
		if err == nil && (role == "owner" || role == "admin") {
			isAuthorized = true
		}
	}

	if !isAuthorized {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admins, owners, or creators can reorder milestones"})
		return
	}

	tx, _ := config.DB.Begin()
	for i, mid := range input.MilestoneIDs {
		_, err := tx.Exec("UPDATE milestones SET position = $1 WHERE id = $2 AND task_id = $3", i, mid, taskID)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update position"})
			return
		}
	}
	tx.Commit()

	c.JSON(http.StatusOK, gin.H{"message": "Milestones reordered"})
}

func UpdateTaskStatus(c *gin.Context) {
	taskID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	userID := c.MustGet("user_id").(int64)

	var input struct {
		Status   string `json:"status"`
		Progress int    `json:"progress"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	var creatorID sql.NullInt64
	inTasksTable := true
	err := config.DB.QueryRow("SELECT creator_id FROM tasks WHERE id = $1", taskID).Scan(&creatorID)
	if err != nil {
		if err == sql.ErrNoRows {
			var workspaceID int64
			errW := config.DB.QueryRow("SELECT creator_id, workspace_id FROM workspace_tasks WHERE id = $1", taskID).Scan(&creatorID, &workspaceID)
			if errW != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
				return
			}
			inTasksTable = false
			var isMember bool
			config.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2)`, workspaceID, userID).Scan(&isMember)
			if !isMember {
				c.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized to update status"})
				return
			}
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
			return
		}
	}

	if (creatorID.Valid && creatorID.Int64 == userID) || !inTasksTable {
		if inTasksTable {
			config.DB.Exec(`UPDATE tasks SET status = $1, progress = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
				strings.ToLower(input.Status), input.Progress, taskID)
		} else {
			config.DB.Exec(`UPDATE workspace_tasks SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
				strings.ToLower(input.Status), taskID)
		}

		services.LogActivity(taskID, userID, "status_updated", fmt.Sprintf("Task status updated to %s", input.Status))
		c.JSON(http.StatusOK, gin.H{"message": "Global status updated"})
		return
	}

	var exists bool
	config.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM task_assignees WHERE task_id=$1 AND user_id=$2)`, taskID, userID).Scan(&exists)
	if exists {
		config.DB.Exec(`UPDATE task_assignees SET status = $1, progress = $2 WHERE task_id = $3 AND user_id = $4`,
			strings.ToLower(input.Status), input.Progress, taskID, userID)

		services.LogActivity(taskID, userID, "status_updated", fmt.Sprintf("Task status updated to %s", input.Status))
		c.JSON(http.StatusOK, gin.H{"message": "Your progress updated"})
		return
	}

	c.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized to update status"})
}

func DeleteTask(c *gin.Context) {
	taskID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	userID := c.MustGet("user_id").(int64)

	var creatorID sql.NullInt64
	config.DB.QueryRow("SELECT creator_id FROM tasks WHERE id = $1", taskID).Scan(&creatorID)
	if !creatorID.Valid || creatorID.Int64 != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Unauthorized"})
		return
	}

	config.DB.Exec(`DELETE FROM tasks WHERE id = $1`, taskID)
	c.JSON(http.StatusOK, gin.H{"message": "Task deleted"})
}

func LeaveTask(c *gin.Context) {
	taskID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	userID := c.MustGet("user_id").(int64)
	config.DB.Exec(`DELETE FROM task_assignees WHERE task_id = $1 AND user_id = $2`, taskID, userID)
	var count int
	config.DB.QueryRow(`SELECT COUNT(*) FROM task_assignees WHERE task_id = $1`, taskID).Scan(&count)
	if count == 0 {
		config.DB.Exec(`UPDATE tasks SET accepted = FALSE, assignee_id = NULL, status = 'pending', progress = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, taskID)
		config.DB.Exec(`UPDATE milestones SET status = 'pending', submission_link = NULL WHERE task_id = $1`, taskID)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Left task"})
}

func ListMyTasks(c *gin.Context) {
	userID := c.MustGet("user_id").(int64)
	search := c.Query("search")

	query := `SELECT t.id, t.title, t.description, t.status, t.accepted, t.creator_id, t.assignee_id, t.deadline, t.progress, t.subject, t.attachment_url, t.created_at, t.updated_at,
	          u_a.name, u_a.photo_url, u_c.name, u_c.photo_url, t.priority, t.ai_optimized, COALESCE(t.capacity, 1) as capacity,
	          t.issue_type, t.labels
	          FROM tasks t LEFT JOIN users u_a ON t.assignee_id = u_a.id LEFT JOIN users u_c ON t.creator_id = u_c.id
	          WHERE EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $1)`

	var tasks []models.Task
	var err error
	if search != "" {
		query += ` AND (t.title ILIKE $2 OR t.description ILIKE $2 OR t.subject ILIKE $2)`
		tasks, err = services.FetchTasksByQuery(query, userID, "%"+search+"%")
	} else {
		tasks, err = services.FetchTasksByQuery(query, userID)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tasks"})
		return
	}
	c.JSON(http.StatusOK, tasks)
}

func ListPostedTasks(c *gin.Context) {
	userID := c.MustGet("user_id").(int64)
	search := c.Query("search")

	query := `SELECT t.id, t.title, t.description, t.status, t.accepted, t.creator_id, t.assignee_id, t.deadline, t.progress, t.subject, t.attachment_url, t.created_at, t.updated_at,
	          u_a.name, u_a.photo_url, u_c.name, u_c.photo_url, t.priority, t.ai_optimized, COALESCE(t.capacity, 1) as capacity,
	          t.issue_type, t.labels
	          FROM tasks t LEFT JOIN users u_a ON t.assignee_id = u_a.id LEFT JOIN users u_c ON t.creator_id = u_c.id WHERE t.creator_id = $1`

	var tasks []models.Task
	var err error
	if search != "" {
		query += ` AND (t.title ILIKE $2 OR t.description ILIKE $2 OR t.subject ILIKE $2)`
		tasks, err = services.FetchTasksByQuery(query, userID, "%"+search+"%")
	} else {
		tasks, err = services.FetchTasksByQuery(query, userID)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tasks"})
		return
	}
	c.JSON(http.StatusOK, tasks)
}

func ListActiveTasks(c *gin.Context) {
	userID := c.MustGet("user_id").(int64)
	search := c.Query("search")

	query := `SELECT t.id, t.title, t.description, t.status, t.accepted, t.creator_id, t.assignee_id, t.deadline, t.progress, t.subject, t.attachment_url, t.created_at, t.updated_at,
	          u_a.name, u_a.photo_url, u_c.name, u_c.photo_url, t.priority, t.ai_optimized, COALESCE(t.capacity, 1) as capacity,
	          t.issue_type, t.labels
	          FROM tasks t LEFT JOIN users u_a ON t.assignee_id = u_a.id LEFT JOIN users u_c ON t.creator_id = u_c.id 
	          WHERE (t.creator_id = $1 OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $2)) 
	          AND t.status IN ('accepted', 'in_progress', 'submitted')`

	var tasks []models.Task
	var err error
	if search != "" {
		query += ` AND (t.title ILIKE $3 OR t.description ILIKE $3 OR t.subject ILIKE $3)`
		tasks, err = services.FetchTasksByQuery(query, userID, userID, "%"+search+"%")
	} else {
		tasks, err = services.FetchTasksByQuery(query, userID, userID)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch active tasks"})
		return
	}
	c.JSON(http.StatusOK, tasks)
}

func PredictPriority(c *gin.Context) {
	var input struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	fmt.Printf("[AI] Predicting Priority for: %s\n", input.Title)
	priority, err := services.PredictTaskPriority(input.Title, input.Description)
	if err != nil {
		fmt.Printf("[AI] Priority Prediction FAILED: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	fmt.Printf("[AI] Priority Predicted: %s\n", priority)
	c.JSON(http.StatusOK, gin.H{"priority": priority})
}

func PredictLabels(c *gin.Context) {
	var input struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	fmt.Printf("[AI] Suggesting Labels for: %s\n", input.Title)
	labels, err := services.SuggestLabels(input.Title, input.Description)
	if err != nil {
		fmt.Printf("[AI] Label Suggestion FAILED: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	fmt.Printf("[AI] Labels Suggested: %v\n", labels)
	c.JSON(http.StatusOK, gin.H{"labels": labels})
}

func GenerateMilestones(c *gin.Context) {
	var input struct {
		TaskID      string `json:"task_id"`
		Title       string `json:"title"`
		Description string `json:"description"`
		Subject     string `json:"subject"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	taskID, _ := strconv.ParseInt(input.TaskID, 10, 64)
	userID := c.MustGet("user_id").(int64)

	var currentCount int
	var creatorID sql.NullInt64
	inTasksTable := true

	err := config.DB.QueryRow("SELECT ai_milestone_count, creator_id FROM tasks WHERE id = $1", taskID).Scan(&currentCount, &creatorID)
	if err != nil {
		if err == sql.ErrNoRows {
			errW := config.DB.QueryRow("SELECT ai_milestone_count, creator_id FROM workspace_tasks WHERE id = $1", taskID).Scan(&currentCount, &creatorID)
			if errW != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
				return
			}
			inTasksTable = false
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}
	}

	if !creatorID.Valid || creatorID.Int64 != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the task creator can generate milestones"})
		return
	}

	if currentCount >= 3 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "AI milestone generation limit reached (max 3 times per task)"})
		return
	}

	milestones, err := services.SuggestMilestones(input.Title, input.Description, input.Subject)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec("DELETE FROM milestones WHERE task_id = $1", taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear old milestones"})
		return
	}

	for _, mTitle := range milestones {
		_, err = tx.Exec("INSERT INTO milestones (task_id, title, status) VALUES ($1, $2, 'pending')", taskID, mTitle)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save new milestones"})
			return
		}
	}

	if inTasksTable {
		_, err = tx.Exec("UPDATE tasks SET ai_milestone_count = ai_milestone_count + 1, ai_optimized = TRUE WHERE id = $1", taskID)
	} else {
		_, err = tx.Exec("UPDATE workspace_tasks SET ai_milestone_count = ai_milestone_count + 1, ai_optimized = TRUE WHERE id = $1", taskID)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update AI usage counter"})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Milestones generated successfully", "milestones": milestones})
}

func RecommendUsers(c *gin.Context) {
	var input struct {
		Subject string `json:"subject"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT id, name, email, field, 
		(SELECT COUNT(*) FROM task_assignees ta WHERE ta.user_id = users.id AND ta.status <> 'completed') as active_tasks 
		FROM users LIMIT 20`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch candidates"})
		return
	}
	defer rows.Close()

	var candidates []map[string]interface{}
	for rows.Next() {
		var id int
		var name, email, field string
		var activeTasks int
		rows.Scan(&id, &name, &email, &field, &activeTasks)
		candidates = append(candidates, map[string]interface{}{
			"id":           id,
			"name":         name,
			"email":        email,
			"field":        field,
			"active_tasks": activeTasks,
		})
	}

	recommendation, err := services.RecommendAssignees(input.Subject, candidates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"recommendation": recommendation})
}

func DeleteMilestone(c *gin.Context) {
	taskID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	milestoneID, _ := strconv.Atoi(c.Param("mid"))
	userID := c.MustGet("user_id").(int64)

	var creatorID sql.NullInt64
	var workspaceID sql.NullInt64
	err := config.DB.QueryRow("SELECT creator_id FROM tasks WHERE id = $1", taskID).Scan(&creatorID)
	if err != nil {
		// Try workspace_tasks
		err = config.DB.QueryRow("SELECT creator_id, workspace_id FROM workspace_tasks WHERE id = $1", taskID).Scan(&creatorID, &workspaceID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
			return
		}
	}

	isAuthorized := (creatorID.Valid && creatorID.Int64 == userID)
	if !isAuthorized && workspaceID.Valid {
		// Check workspace role
		var role string
		err = config.DB.QueryRow(`SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, workspaceID.Int64, userID).Scan(&role)
		if err == nil && (role == "owner" || role == "admin") {
			isAuthorized = true
		}
	}

	if !isAuthorized {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admins, owners, or creators can delete milestones"})
		return
	}

	_, err = config.DB.Exec("DELETE FROM milestones WHERE id = $1 AND task_id = $2", milestoneID, taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete milestone"})
		return
	}

	services.LogActivity(taskID, userID, "milestone_deleted", "Deleted a milestone")
	c.JSON(http.StatusOK, gin.H{"message": "Milestone deleted"})
}

func AddComment(c *gin.Context) {
	taskID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	userID := c.MustGet("user_id").(int64)

	var input struct {
		Content string `json:"content"`
	}
	if err := c.BindJSON(&input); err != nil || strings.TrimSpace(input.Content) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Comment content is required"})
		return
	}

	services.LogActivity(taskID, userID, "comment", input.Content)
	c.JSON(http.StatusCreated, gin.H{"message": "Comment added"})
}

func ImproveWriting(c *gin.Context) {
	var input struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Subject     string `json:"subject"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	fmt.Printf("[AI] Improving Writing for: %s\n", input.Title)
	improved, err := services.ImproveTaskWriting(input.Title, input.Description, input.Subject)
	if err != nil {
		fmt.Printf("[AI] Writing Improvement FAILED: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, improved)
}
