package services

import (
	"backend/config"
	"backend/models"
	"database/sql"
	"strings"
)

func FindUserByEmail(email string) (*models.User, error) {
	var user models.User
	var password sql.NullString

	query := "SELECT id, name, email, password, provider, COALESCE(is_verified, FALSE) FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))"
	err := config.DB.QueryRow(query, email).Scan(&user.ID, &user.Name, &user.Email, &password, &user.Provider, &user.IsVerified)

	if err != nil {
		return nil, err
	}

	if password.Valid {
		p := password.String
		user.Password = &p
	}

	return &user, nil
}

func CheckUserExists(email string) (int64, bool, string, error) {
	var id int64
	var isVerified bool
	var provider string
	err := config.DB.QueryRow("SELECT id, is_verified, provider FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))", email).Scan(&id, &isVerified, &provider)
	return id, isVerified, provider, err
}

func NullableString(v string) interface{} {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	return v
}

func NullToEmpty(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}
