package controllers

import (
	"context"
	"database/sql"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"backend/config"
	"backend/models"
	"backend/services"
	"backend/utils"

	firebaseauth "firebase.google.com/go/v4/auth"
	"github.com/gin-gonic/gin"
)

func Signup(c *gin.Context) {

	var input struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	input.Name = strings.TrimSpace(input.Name)
	input.Email = strings.TrimSpace(input.Email)
	if input.Name == "" || input.Email == "" || len(input.Password) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input, ensure all fields are provided and password is at least 6 characters"})
		return
	}

	hashedPassword, err := utils.HashPassword(input.Password)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password must be between 6 and 72 bytes"})
		return
	}
	var userID int64
	err = config.DB.QueryRow(`INSERT INTO users (name, email, password, provider, email_verified, is_verified)
		VALUES ($1, $2, $3, 'password', FALSE, FALSE)
		ON CONFLICT (email) DO NOTHING RETURNING id`, input.Name, input.Email, hashedPassword).Scan(&userID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusConflict, gin.H{"error": "An account with this email already exists. Please sign in."})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Account created. You can now sign in."})
}

func Login(c *gin.Context) {

	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	user, err := services.FindUserByEmail(strings.TrimSpace(input.Email))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if user.Password == nil || !utils.CheckPasswordHash(input.Password, *user.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	tokenString, _ := utils.GenerateToken(user.ID)
	setAuthCookie(c, tokenString)
	c.JSON(http.StatusOK, gin.H{"message": "Login successful"})
}

func GoogleAuth(c *gin.Context) {
	var input struct {
		Token string `json:"token"`
	}
	if err := c.BindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token is required"})
		return
	}

	if config.FirebaseAuth == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Google sign-in is not configured"})
		return
	}
	decoded, err := config.FirebaseAuth.VerifyIDToken(context.Background(), input.Token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid Firebase token"})
		return
	}

	uid := decoded.UID
	email, _ := decoded.Claims["email"].(string)
	name, _ := decoded.Claims["name"].(string)
	picture, _ := decoded.Claims["picture"].(string)

	if verified, ok := decoded.Claims["email_verified"].(bool); !ok || !verified || email == "" || decoded.Firebase.SignInProvider != "google.com" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "A verified Google account is required"})
		return
	}
	var userID int64
	err = config.DB.QueryRow("SELECT id FROM users WHERE uid = $1", uid).Scan(&userID)
	if err == sql.ErrNoRows {
		// Email/password addresses are no longer verified. Do not silently link
		// a Google identity to a password account based on its claimed address.
		err = config.DB.QueryRow(`INSERT INTO users (uid, name, email, photo_url, provider, email_verified, is_verified)
			VALUES ($1, $2, $3, $4, 'google', TRUE, TRUE)
			ON CONFLICT (email) DO NOTHING RETURNING id`, uid, name, email, services.NullableString(picture)).Scan(&userID)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusConflict, gin.H{"error": "An account already uses this email. Sign in with its existing login method."})
			return
		}
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Unable to sign in with Google"})
		return
	}
	tokenString, _ := utils.GenerateToken(userID)
	setAuthCookie(c, tokenString)
	c.JSON(http.StatusOK, gin.H{"id": strconv.FormatInt(userID, 10), "name": name, "email": email})
}

func CheckAuth(c *gin.Context) {
	token, err := c.Cookie("token")
	if err != nil || token == "" {
		c.JSON(http.StatusOK, gin.H{"authenticated": false})
		return
	}

	userID, err := utils.ValidateToken(token)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"authenticated": false})
		return
	}

	var isVerified bool
	config.DB.QueryRow("SELECT COALESCE(is_verified, FALSE) FROM users WHERE id = $1", userID).Scan(&isVerified)
	c.JSON(http.StatusOK, gin.H{"authenticated": true, "user_id": strconv.FormatInt(userID, 10), "is_verified": isVerified})
}

func Logout(c *gin.Context) {
	setAuthCookie(c, "")
	c.JSON(http.StatusOK, gin.H{"message": "Logout successful"})
}
func GetProfile(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var user models.User
	var uid, photo, field, college, year sql.NullString

	query := "SELECT id, uid, name, email, photo_url, provider, field, college_name, year, is_verified, xp, level, badges, created_at FROM users WHERE id = $1"
	err := config.DB.QueryRow(query, userID).Scan(&user.ID, &uid, &user.Name, &user.Email, &photo, &user.Provider, &field, &college, &year, &user.IsVerified, &user.XP, &user.Level, &user.Badges, &user.CreatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":   strconv.FormatUint(uint64(user.ID), 10),
		"name": user.Name, "email": user.Email, "photo_url": services.NullToEmpty(photo),
		"field": services.NullToEmpty(field), "college_name": services.NullToEmpty(college), "year": services.NullToEmpty(year),
		"provider": user.Provider, "is_verified": user.IsVerified, "created_at": user.CreatedAt,
		"xp": user.XP, "level": user.Level, "badges": user.Badges,
	})
}

func UpdateProfile(c *gin.Context) {
	userID, _ := c.Get("user_id")
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, services.MaxUploadSize+(1<<20))
	if err := c.Request.ParseMultipartForm(services.MaxUploadSize); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse form"})
		return
	}

	defer c.Request.MultipartForm.RemoveAll()
	name := c.Request.FormValue("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Name cannot be empty"})
		return
	}
	query := "UPDATE users SET name = $1, field = $2, college_name = $3, year = $4 WHERE id = $5"
	config.DB.Exec(query, name, services.NullableString(c.Request.FormValue("field")), services.NullableString(c.Request.FormValue("college_name")), services.NullableString(c.Request.FormValue("year")), userID)

	if file, header, err := c.Request.FormFile("photo"); err == nil {
		defer file.Close()
		photoURL, err := services.UploadFile(file, header.Filename)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		config.DB.Exec("UPDATE users SET photo_url = $1 WHERE id = $2", photoURL, userID)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Profile updated successfully"})
}

func setAuthCookie(c *gin.Context, token string) {
	isSecure := os.Getenv("GIN_MODE") == "release"
	maxAge := 86400
	if token == "" {
		maxAge = -1
	}
	if isSecure {
		c.SetSameSite(http.SameSiteNoneMode)
	} else {
		c.SetSameSite(http.SameSiteLaxMode)
	}
	c.SetCookie("token", token, maxAge, "/", "", isSecure, true)
}

func ChangePassword(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var input struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := c.ShouldBindJSON(&input); err != nil || input.CurrentPassword == "" || len(input.NewPassword) < 6 || len(input.NewPassword) > 72 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Current password and a new password of 6–72 bytes are required"})
		return
	}
	var storedHash sql.NullString
	var provider string
	if err := config.DB.QueryRow("SELECT password, provider FROM users WHERE id = $1", userID).Scan(&storedHash, &provider); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	if provider != "password" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Manage your Google password through your Google account"})
		return
	}
	if !storedHash.Valid || !utils.CheckPasswordHash(input.CurrentPassword, storedHash.String) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Incorrect current password"})
		return
	}
	newHash, err := utils.HashPassword(input.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to secure password"})
		return
	}
	if _, err := config.DB.Exec("UPDATE users SET password = $1, verification_token = NULL, verification_token_expires = NULL WHERE id = $2", newHash, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Password changed successfully"})
}

func DeleteAccount(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var input struct {
		CurrentPassword string `json:"current_password"`
		GoogleToken     string `json:"google_token"`
	}
	if err := c.ShouldBindJSON(&input); err != nil || (input.CurrentPassword == "" && input.GoogleToken == "") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Confirm your password or sign in with Google again"})
		return
	}
	var storedHash, uid sql.NullString
	var provider string
	err := config.DB.QueryRow("SELECT password, provider, uid FROM users WHERE id = $1", userID).Scan(&storedHash, &provider, &uid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	if provider == "google" {
		if config.FirebaseAuth == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Google sign-in is not configured"})
			return
		}
		token, err := config.FirebaseAuth.VerifyIDToken(c.Request.Context(), input.GoogleToken)
		if err != nil || !uid.Valid || !matchesGoogleConfirmation(token, uid.String) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Sign in again with the Google account used for this profile"})
			return
		}
	} else if !storedHash.Valid || !utils.CheckPasswordHash(input.CurrentPassword, storedHash.String) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Incorrect current password"})
		return
	}

	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	defer tx.Rollback()
	for _, statement := range []string{
		"DELETE FROM task_assignees WHERE user_id = $1",
		"DELETE FROM task_invitations WHERE invitee_email IN (SELECT email FROM users WHERE id = $1)",
		"DELETE FROM tasks WHERE creator_id = $1",
		"UPDATE activities SET user_id = NULL WHERE user_id = $1",
		"DELETE FROM users WHERE id = $1",
	} {
		if _, err := tx.Exec(statement, userID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
			return
		}
	}
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}
	setAuthCookie(c, "")
	c.JSON(http.StatusOK, gin.H{"message": "Account deleted successfully"})
}

func matchesGoogleConfirmation(token *firebaseauth.Token, uid string) bool {
	if token == nil || uid == "" {
		return false
	}
	now := time.Now().Unix()
	return token.UID == uid && token.Firebase.SignInProvider == "google.com" &&
		token.AuthTime <= now+30 && now-token.AuthTime <= 300
}
