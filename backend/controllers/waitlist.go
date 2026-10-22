package controllers

import (
	"backend/config"
	"net/http"

	"github.com/gin-gonic/gin"
)

func JoinWaitlist(c *gin.Context) {
	var input struct {
		Email string `json:"email"`
	}

	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email is required"})
		return
	}

	if input.Email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email cannot be empty"})
		return
	}

	_, err := config.DB.Exec("INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING", input.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join waitlist"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully joined the waitlist!"})
}
