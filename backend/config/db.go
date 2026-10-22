package config

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"embed"
	"fmt"
	"log"
	"net/url"
	"os"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

var DB *sql.DB

//go:embed migrations/*.sql
var migrationFiles embed.FS

func databaseDSN(raw string) (string, error) {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "postgres" && u.Scheme != "postgresql") || u.Host == "" {
		return "", fmt.Errorf("DATABASE_URL must be a PostgreSQL connection URL from Supabase's Connect dialog")
	}
	q := u.Query()
	q.Set("search_path", "tasknest")
	q.Set("application_name", "TaskNest")
	q.Set("connect_timeout", "10")
	if q.Get("sslmode") == "" {
		q.Set("sslmode", "require")
	}
	if os.Getenv("GIN_MODE") == "release" && q.Get("sslmode") != "require" && q.Get("sslmode") != "verify-ca" && q.Get("sslmode") != "verify-full" {
		return "", fmt.Errorf("production DATABASE_URL must require TLS")
	}
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func ConnectDatabase() {
	dsn, err := databaseDSN(os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	database, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal("Unable to configure PostgreSQL connection")
	}
	database.SetMaxOpenConns(5)
	database.SetMaxIdleConns(2)
	database.SetConnMaxLifetime(30 * time.Minute)
	database.SetConnMaxIdleTime(5 * time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	if err := database.PingContext(ctx); err != nil {
		database.Close()
		log.Fatal("Unable to connect to PostgreSQL; check DATABASE_URL, password, pooler hostname, and network access")
	}
	if err := ApplyMigrations(ctx, database); err != nil {
		database.Close()
		log.Fatalf("Database migrations failed: %v", err)
	}
	DB = database
	log.Println("Connected to PostgreSQL; TaskNest schema is up to date")
}

// ApplyMigrations applies checked-in migrations once, atomically, using a lock to
// prevent simultaneous backend replicas from racing during their first startup.
func ApplyMigrations(ctx context.Context, database *sql.DB) error {
	tx, err := database.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(841927304);
 CREATE SCHEMA IF NOT EXISTS tasknest;
 REVOKE ALL ON SCHEMA tasknest FROM PUBLIC;
 CREATE TABLE IF NOT EXISTS tasknest.schema_migrations (
 version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
 );`); err != nil {
		return fmt.Errorf("initialize migrations: %w", err)
	}
	entries, err := migrationFiles.ReadDir("migrations")
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		contents, err := migrationFiles.ReadFile("migrations/" + entry.Name())
		if err != nil {
			return err
		}
		checksum := fmt.Sprintf("%x", sha256.Sum256(contents))
		var existing string
		err = tx.QueryRowContext(ctx, "SELECT checksum FROM tasknest.schema_migrations WHERE version = $1", entry.Name()).Scan(&existing)
		if err == nil {
			if existing != checksum {
				return fmt.Errorf("migration %s has changed since it was applied", entry.Name())
			}
			continue
		}
		if err != sql.ErrNoRows {
			return err
		}
		if _, err := tx.ExecContext(ctx, string(contents)); err != nil {
			return fmt.Errorf("migration %s: %w", entry.Name(), err)
		}
		if _, err := tx.ExecContext(ctx, "INSERT INTO tasknest.schema_migrations (version, checksum) VALUES ($1,$2)", entry.Name(), checksum); err != nil {
			return err
		}
	}
	return tx.Commit()
}
