package config

import (
	"context"
	"database/sql"
	"net/url"
	"os"
	"testing"
	"time"
)

func TestDatabaseDSNScopesConnectionsToPrivateSchema(t *testing.T) {
	t.Setenv("GIN_MODE", "debug")
	result, err := databaseDSN("postgresql://postgres.project:fake-password@pooler.example:5432/postgres?search_path=public")
	if err != nil {
		t.Fatal(err)
	}
	u, err := url.Parse(result)
	if err != nil {
		t.Fatal(err)
	}
	if u.Query().Get("search_path") != "tasknest" || u.Query().Get("sslmode") != "require" || u.Query().Get("connect_timeout") != "10" {
		t.Fatal("missing PostgreSQL connection defaults")
	}
	if u.User.Username() != "postgres.project" {
		t.Fatal("pooler username changed")
	}
}
func TestDatabaseDSNRejectsInvalidAndInsecureProduction(t *testing.T) {
	t.Setenv("GIN_MODE", "release")
	for _, input := range []string{"", "mysql://host/db", "postgresql://host/db?sslmode=disable", "postgresql://host/db?sslmode=prefer"} {
		if _, err := databaseDSN(input); err == nil {
			t.Fatal("invalid database configuration accepted")
		}
	}
}
func TestPostgresMigrationAndSchemaIntegration(t *testing.T) {
	raw := os.Getenv("TEST_DATABASE_URL")
	if raw == "" {
		t.Skip("set TEST_DATABASE_URL to an isolated PostgreSQL/Supabase test database")
	}
	dsn, err := databaseDSN(raw)
	if err != nil {
		t.Fatal(err)
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	for range 2 {
		if err := ApplyMigrations(ctx, db); err != nil {
			t.Fatal(err)
		}
	}
	smoke, err := os.ReadFile("testdata/supabase_smoke.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, string(smoke)); err != nil {
		t.Fatal(err)
	}
}
