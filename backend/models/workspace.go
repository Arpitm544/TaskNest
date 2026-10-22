package models

import "time"

type WorkspaceType string

const (
	WorkspaceTypePersonal WorkspaceType = "personal"
	WorkspaceTypeTeam     WorkspaceType = "team"
)

type WorkspaceRole string

const (
	WorkspaceRoleOwner  WorkspaceRole = "owner"
	WorkspaceRoleAdmin  WorkspaceRole = "admin"
	WorkspaceRoleMember WorkspaceRole = "member"
	WorkspaceRoleViewer WorkspaceRole = "viewer"
)

type Workspace struct {
	ID          int64         `json:"id,string"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Type        WorkspaceType `json:"type"`
	Category    string        `json:"category"`
	OwnerID     int64         `json:"owner_id,string"`
	InviteCode  string        `json:"invite_code"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`

	// Joined fields
	MemberCount int           `json:"member_count"`
	UserRole    WorkspaceRole `json:"user_role"`
	OwnerName   string        `json:"owner_name"`
}

type WorkspaceMember struct {
	WorkspaceID int64         `json:"workspace_id,string"`
	UserID      int64         `json:"user_id,string"`
	Role        WorkspaceRole `json:"role"`
	JoinedAt    time.Time     `json:"joined_at"`

	Name     string `json:"name"`
	Email    string `json:"email"`
	PhotoURL string `json:"photo_url"`
}

type WorkspaceInvitation struct {
	ID          int64     `json:"id,string"`
	WorkspaceID int64     `json:"workspace_id,string"`
	InviterID   int64     `json:"inviter_id,string"`
	Email       string    `json:"email"`
	Role        string    `json:"role"`
	Status      string    `json:"status"`
	Token       string    `json:"token"`
	ExpiresAt   time.Time `json:"expires_at"`
	CreatedAt   time.Time `json:"created_at"`
	WorkspaceName string `json:"workspace_name"`
	InviterName   string `json:"inviter_name"`
}

type WorkspaceTask struct {
	ID          int64      `json:"id,string"`
	WorkspaceID int64      `json:"workspace_id,string"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Status      string     `json:"status"`
	Priority    string     `json:"priority"`
	CreatorID   *int64      `json:"creator_id,string"`
	AssigneeID  *int64     `json:"assignee_id,string"`
	MilestoneID *int64     `json:"milestone_id,string"`
	DueDate     *time.Time `json:"due_date"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`

	CreatorName      string `json:"creator_name"`
	CreatorPhotoURL  string `json:"creator_photo_url"`
	AssigneeName     string `json:"assignee_name"`
	AssigneeEmail    string `json:"assignee_email"`
	AssigneePhotoURL string `json:"assignee_photo_url"`
	MilestoneTitle   string `json:"milestone_title"`
	Subject          string   `json:"subject"`
	AttachmentURL    string   `json:"attachment_url"`
	IssueType        string   `json:"issue_type"`
	Labels           []string `json:"labels"`
}

type WorkspaceMilestone struct {
	ID          int64     `json:"id,string"`
	WorkspaceID int64     `json:"workspace_id,string"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	DueDate     *time.Time `json:"due_date"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	TotalTasks     int     `json:"total_tasks"`
	CompletedTasks int     `json:"completed_tasks"`
	Progress       float64 `json:"progress"`
}
type WorkspaceActivity struct {
	ID          int64     `json:"id,string"`
	WorkspaceID int64     `json:"workspace_id,string"`
	UserID      int64     `json:"user_id,string"`
	Action      string    `json:"action"`
	Details     string    `json:"details"`
	EntityType  string    `json:"entity_type"`
	EntityID    *int64    `json:"entity_id,string"`
	CreatedAt   time.Time `json:"created_at"`
	UserName     string `json:"user_name"`
	UserPhotoURL string `json:"user_photo_url"`
	EntityTitle  string `json:"entity_title"`
}
