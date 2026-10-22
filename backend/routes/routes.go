package routes

import (
	"backend/controllers"
	"backend/utils"
	"fmt"
	"github.com/gin-gonic/gin"
	"net/http"
)

func SetupRoutes(r *gin.Engine) {
	r.POST("/api/waitlist", controllers.JoinWaitlist)

	auth := r.Group("/api/auth")
	{
		auth.POST("/signup", controllers.Signup)
		auth.POST("/login", controllers.Login)
		auth.POST("/google", controllers.GoogleAuth)
		auth.POST("/logout", controllers.Logout)
		auth.GET("/check", controllers.CheckAuth)
	}

	requireAuth := func(c *gin.Context) {
		token, err := c.Cookie("token")
		if err != nil || token == "" {
			fmt.Printf("[AUTH] No token found in cookie for request %s\n", c.Request.URL.Path)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		userID, err := utils.ValidateToken(token)
		if err != nil {
			fmt.Printf("[AUTH] Invalid token for request %s: %v\n", c.Request.URL.Path, err)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		c.Set("user_id", userID)
		c.Next()
	}

	r.POST("/api/tasks/ai/predict-priority", requireAuth, controllers.PredictPriority)
	r.POST("/api/tasks/ai/predict-labels", requireAuth, controllers.PredictLabels)
	r.POST("/api/tasks/ai/generate-milestones", requireAuth, controllers.GenerateMilestones)
	r.POST("/api/tasks/ai/recommend-users", requireAuth, controllers.RecommendUsers)
	r.POST("/api/tasks/ai/improve-writing", requireAuth, controllers.ImproveWriting)

	tasks := r.Group("/tasks")
	tasks.Use(requireAuth)
	{
		tasks.POST("", controllers.CreateTask)
		tasks.GET("", controllers.ListTasks)
		tasks.GET("/dashboard", controllers.ListDashboardTasks)
		tasks.GET("/mine", controllers.ListMyTasks)
		tasks.GET("/posted", controllers.ListPostedTasks)
		tasks.GET("/active", controllers.ListActiveTasks)
		tasks.GET("/detail/:id", controllers.GetTask)
		tasks.POST("/:id/accept", controllers.AcceptTask)
		tasks.POST("/:id/leave", controllers.LeaveTask)
		tasks.POST("/:id/status", controllers.UpdateTaskStatus)
		tasks.PUT("/:id", controllers.UpdateTask)
		tasks.DELETE("/:id", controllers.DeleteTask)

		tasks.POST("/:id/invite", controllers.InviteUser)
		tasks.GET("/invitations", controllers.ListInvitations)
		tasks.POST("/invitations/:id/respond", controllers.RespondToInvitation)

		tasks.POST("/:id/milestones", controllers.AddMilestone)
		tasks.POST("/:id/milestones/:mid/status", controllers.UpdateMilestoneStatus)
		tasks.POST("/:id/milestones/:mid/submit", controllers.SubmitMilestoneForReview)
		tasks.POST("/:id/milestones/:mid/assign", controllers.AssignMilestone)
		tasks.POST("/:id/milestones/reorder", controllers.ReorderMilestones)
		tasks.DELETE("/:id/milestones/:mid", controllers.DeleteMilestone)
		tasks.POST("/:id/comments", controllers.AddComment)
	}

	workspaces := r.Group("/api/workspaces")
	workspaces.Use(requireAuth)
	{
		workspaces.POST("", controllers.CreateWorkspace)
		workspaces.GET("", controllers.ListWorkspaces)
		workspaces.GET("/:id", controllers.GetWorkspace)
		workspaces.DELETE("/:id", controllers.DeleteWorkspace)

		workspaces.POST("/:id/members", controllers.InviteWorkspaceMember)
		workspaces.DELETE("/:id/members/:userId", controllers.RemoveWorkspaceMember)
		workspaces.GET("/:id/members", controllers.ListWorkspaceMembers)

		workspaces.POST("/:id/tasks", controllers.CreateWorkspaceTask)
		workspaces.GET("/:id/tasks", controllers.ListWorkspaceTasks)
		workspaces.PUT("/:id/tasks/:taskId/status", controllers.UpdateWorkspaceTaskStatus)

		workspaces.POST("/:id/milestones", controllers.CreateWorkspaceMilestone)
		workspaces.GET("/:id/milestones", controllers.ListWorkspaceMilestones)

		workspaces.POST("/join/:code", controllers.JoinWorkspaceByCode)
		workspaces.GET("/:id/activities", controllers.ListWorkspaceActivities)
	}

	user := r.Group("/api/user")
	user.Use(requireAuth)
	{
		user.GET("/profile", controllers.GetProfile)
		user.PUT("/profile", controllers.UpdateProfile)
		user.POST("/change-password", controllers.ChangePassword)
		user.POST("/delete-account", controllers.DeleteAccount)
	}

	r.POST("/api/upload", requireAuth, controllers.UploadHandler)
}
