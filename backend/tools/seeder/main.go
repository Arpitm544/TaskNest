package main

import (
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"net/url"
	"os"
	"path/filepath"
	"time"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	workDir, _ := os.Getwd()
	envPath := filepath.Join(workDir, "..", "..", ".env")
	if err := godotenv.Load(envPath); err != nil {
		log.Println("Note: Using system environment variables (No .env found at", envPath, ")")
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL not set")
	}
	connection, err := url.Parse(dsn)
	if err != nil || (connection.Scheme != "postgres" && connection.Scheme != "postgresql") {
		log.Fatal("DATABASE_URL must be a PostgreSQL URL")
	}
	parameters := connection.Query()
	parameters.Set("search_path", "tasknest")
	if parameters.Get("sslmode") == "" {
		parameters.Set("sslmode", "require")
	}
	connection.RawQuery = parameters.Encode()
	db, err := sql.Open("postgres", connection.String())
	if err != nil {
		log.Fatal("Failed to open DB:", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatal("Failed to ping DB:", err)
	}
	fmt.Println("✅ Connected to Database for Seeding")

	fmt.Println("Seeding Users...")
	users := []struct {
		Name    string
		Email   string
		Field   string
		College string
	}{
		{"Alice Johnson", "alice@test.com", "Computer Science", "MIT"},
		{"Bob Smith", "bob@test.com", "Digital Arts", "NYU"},
		{"Charlie Brown", "charlie@test.com", "Business Management", "Stanford"},
		{"Diana Prince", "diana@test.com", "Law", "Harvard"},
		{"Ethan Hunt", "ethan@test.com", "Cyber Security", "Caltech"},
	}

	var userIDs []int64
	for _, u := range users {
		var id int64
		err := db.QueryRow(
			"INSERT INTO users (name, email, field, college_name, is_verified, email_verified, provider) VALUES ($1, $2, $3, $4, TRUE, TRUE, 'password') ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id",
			u.Name, u.Email, u.Field, u.College,
		).Scan(&id)
		if err != nil {
			fmt.Printf("Skipping user %s: %v\n", u.Name, err)
			db.QueryRow("SELECT id FROM users WHERE email = $1", u.Email).Scan(&id)
		}
		userIDs = append(userIDs, id)
	}

	fmt.Println("Seeding Tasks...")
	subjects := []string{"Programming", "UI/UX Design", "Economics", "Constitutional Law", "Networking"}
	priorities := []string{"Low", "Medium", "High", "Critical"}
	issueTypes := []string{"Task", "Bug", "Story", "Epic"}
	labelsPool := [][]string{
		{"frontend", "react", "urgent"},
		{"backend", "go", "database"},
		{"research", "documentation"},
		{"testing", "qa"},
	}

	for i := 1; i <= 20; i++ {
		creatorID := userIDs[rand.Intn(len(userIDs))]
		subject := subjects[rand.Intn(len(subjects))]
		priority := priorities[rand.Intn(len(priorities))]
		issueType := issueTypes[rand.Intn(len(issueTypes))]
		labels := labelsPool[rand.Intn(len(labelsPool))]

		title := fmt.Sprintf("Academic Task #%d: %s project", i, subject)
		description := fmt.Sprintf("This is a comprehensive description for task %d involving %s. We need to complete this before the semester ends.", i, subject)

		var taskID int64
		err := db.QueryRow(
			`INSERT INTO tasks (title, description, status, creator_id, subject, priority, issue_type, labels, capacity, deadline) 
			 VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
			title, description, creatorID, subject, priority, issueType, fmt.Sprintf("{%s}", join(labels)), rand.Intn(3)+1, time.Now().AddDate(0, 0, rand.Intn(14)),
		).Scan(&taskID)

		if err != nil {
			fmt.Printf("Error seeding task %d: %v\n", i, err)
			continue
		}

		if rand.Float32() > 0.5 {
			for j := 1; j <= 3; j++ {
				db.Exec("INSERT INTO milestones (task_id, title, status) VALUES ($1, $2, 'pending')", taskID, fmt.Sprintf("Milestone %d for Task %d", j, taskID))
			}
		}
	}

	fmt.Println("✅ Seeding Completed Successfully!")
}

func join(s []string) string {
	res := ""
	for i, v := range s {
		if i > 0 {
			res += ","
		}
		res += v
	}
	return res
}
