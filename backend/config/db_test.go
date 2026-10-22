package config

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"net/url"
	"os"
	"strings"
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
	for _, input := range []string{"", "mysql://host/db", "postgresql:///db", "postgresql://host/db?sslmode=disable", "postgresql://host/db?sslmode=prefer"} {
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
	if _, err := db.ExecContext(ctx, strings.TrimPrefix(string(smoke), "\\set ON_ERROR_STOP on\n")); err != nil {
		t.Fatal(err)
	}
}

// A manually pre-applied schema has no history row. Its bootstrap must be safe
// to replay before ApplyMigrations records the version.
func TestInitialMigrationReplayIntegration(t *testing.T) {
	raw := os.Getenv("TEST_DATABASE_URL")
	if raw == "" {
		t.Skip("set TEST_DATABASE_URL to an isolated PostgreSQL test database")
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
	tx, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	initial, err := migrationFiles.ReadFile("migrations/001_initial.sql")
	if err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if _, err := tx.Exec(string(initial)); err != nil {
			t.Fatal(err)
		}
	}
}

type pingConnector struct {
	attempts  *int
	succeedAt int
}

func (p pingConnector) Connect(context.Context) (driver.Conn, error) { return pingConn{p}, nil }
func (p pingConnector) Driver() driver.Driver                        { return nil }

type pingConn struct{ pingConnector }

func (p pingConn) Ping(context.Context) error {
	*p.attempts++
	if p.succeedAt > 0 && *p.attempts >= p.succeedAt {
		return nil
	}
	return errors.New("temporary database outage")
}
func (pingConn) Prepare(string) (driver.Stmt, error) { return nil, errors.New("unexpected prepare") }
func (pingConn) Begin() (driver.Tx, error)           { return nil, errors.New("unexpected transaction") }
func (pingConn) Close() error                        { return nil }
func TestDatabasePingRetriesAreBoundedAndCancellable(t *testing.T) {
	for _, succeedAt := range []int{3, 0} {
		attempts := 0
		db := sql.OpenDB(pingConnector{&attempts, succeedAt})
		err := pingDatabase(context.Background(), db, 5, 0)
		db.Close()
		expected := 5
		if succeedAt > 0 {
			expected = succeedAt
		}
		if attempts != expected || (err == nil) != (succeedAt > 0) {
			t.Fatalf("attempts=%d err=%v", attempts, err)
		}
	}
	attempts := 0
	db := sql.OpenDB(pingConnector{&attempts, 0})
	defer db.Close()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := pingDatabase(ctx, db, 5, time.Hour); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancellation ignored: %v", err)
	}
}
