package controllers

import (
	"backend/config"
	"backend/utils"
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"io"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	firebaseauth "firebase.google.com/go/v4/auth"

	"github.com/gin-gonic/gin"
)

// This in-memory SQL driver exercises handler decisions and transaction outcomes
// without contacting or changing a user's database.
type accountDB struct {
	hash                  string
	exists                bool
	writes                int
	committed, rolledBack bool
	failWrites            bool
}
type accountConnector struct{ state *accountDB }

func (c accountConnector) Connect(context.Context) (driver.Conn, error) {
	return &accountConn{c.state}, nil
}
func (c accountConnector) Driver() driver.Driver { return accountDriver{} }

type accountDriver struct{}

func (accountDriver) Open(string) (driver.Conn, error) { return nil, errors.New("use connector") }

type accountConn struct{ state *accountDB }

func (*accountConn) Prepare(string) (driver.Stmt, error) {
	return nil, errors.New("unexpected prepare")
}
func (*accountConn) Close() error                { return nil }
func (c *accountConn) Begin() (driver.Tx, error) { return accountTx{c.state}, nil }
func (c *accountConn) QueryContext(_ context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	if strings.HasPrefix(query, "INSERT INTO users") {
		if c.state.exists {
			return &accountRows{columns: []string{"id"}}, nil
		}
		c.state.exists = true
		c.state.hash = args[2].Value.(string)
		return &accountRows{columns: []string{"id"}, values: []driver.Value{int64(42)}}, nil
	}
	if strings.Contains(query, "SELECT password, provider, uid") {
		return &accountRows{columns: []string{"password", "provider", "uid"}, values: []driver.Value{c.state.hash, "password", nil}}, nil
	}
	if strings.Contains(query, "SELECT password, provider") {
		return &accountRows{columns: []string{"password", "provider"}, values: []driver.Value{c.state.hash, "password"}}, nil
	}
	return nil, errors.New("unexpected query: " + query)
}
func (c *accountConn) ExecContext(_ context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	if c.state.failWrites {
		return nil, errors.New("write failure")
	}
	c.state.writes++
	if strings.HasPrefix(query, "UPDATE users SET password") {
		c.state.hash = args[0].Value.(string)
	}
	return driver.RowsAffected(1), nil
}

type accountTx struct{ state *accountDB }

func (tx accountTx) Commit() error   { tx.state.committed = true; return nil }
func (tx accountTx) Rollback() error { tx.state.rolledBack = true; return nil }

type accountRows struct {
	columns []string
	values  []driver.Value
	done    bool
}

func (r *accountRows) Columns() []string { return r.columns }
func (*accountRows) Close() error        { return nil }
func (r *accountRows) Next(dest []driver.Value) error {
	if r.done || r.values == nil {
		return io.EOF
	}
	r.done = true
	copy(dest, r.values)
	return nil
}
func useAccountDB(t *testing.T, state *accountDB) {
	t.Helper()
	old := config.DB
	db := sql.OpenDB(accountConnector{state})
	config.DB = db
	t.Cleanup(func() { db.Close(); config.DB = old })
}
func callAccountHandler(handler gin.HandlerFunc, body string) *httptest.ResponseRecorder {
	response := httptest.NewRecorder()
	router := gin.New()
	router.POST("/", func(c *gin.Context) { c.Set("user_id", int64(42)); handler(c) })
	request := httptest.NewRequest("POST", "/", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(response, request)
	return response
}
func TestSignupWithoutEmailAndDuplicateDoesNotReplacePassword(t *testing.T) {
	state := &accountDB{}
	useAccountDB(t, state)
	response := callAccountHandler(Signup, `{"name":"Student","email":"student@example.com","password":"original-password"}`)
	if response.Code != 201 || !utils.CheckPasswordHash("original-password", state.hash) {
		t.Fatalf("signup failed: %d %s", response.Code, response.Body)
	}
	originalHash := state.hash
	response = callAccountHandler(Signup, `{"name":"Other","email":"student@example.com","password":"replacement-password"}`)
	if response.Code != 409 || state.hash != originalHash {
		t.Fatal("duplicate signup must not replace an existing password")
	}
}
func TestPasswordChangeRequiresCurrentPasswordWithoutOTP(t *testing.T) {
	hash, err := utils.HashPassword("current-password")
	if err != nil {
		t.Fatal(err)
	}
	state := &accountDB{exists: true, hash: hash}
	useAccountDB(t, state)
	for _, body := range []string{`{"current_password":"wrong","new_password":"new-password"}`, `{"current_password":"current-password","new_password":"short"}`} {
		response := callAccountHandler(ChangePassword, body)
		if response.Code == 200 || state.writes != 0 {
			t.Fatal("invalid password confirmation changed account")
		}
	}
	response := callAccountHandler(ChangePassword, `{"current_password":"current-password","new_password":"new-password"}`)
	if response.Code != 200 || !utils.CheckPasswordHash("new-password", state.hash) {
		t.Fatalf("password change failed: %d %s", response.Code, response.Body)
	}
}
func TestDeletionRequiresPasswordAndRollsBackOnFailure(t *testing.T) {
	hash, err := utils.HashPassword("current-password")
	if err != nil {
		t.Fatal(err)
	}
	state := &accountDB{exists: true, hash: hash}
	useAccountDB(t, state)
	for _, body := range []string{`{}`, `{"current_password":"wrong"}`, `{"otp":"123456"}`} {
		response := callAccountHandler(DeleteAccount, body)
		if response.Code == 200 || state.writes != 0 || state.committed {
			t.Fatal("deletion accepted without password confirmation")
		}
	}
	state.failWrites = true
	response := callAccountHandler(DeleteAccount, `{"current_password":"current-password"}`)
	if response.Code != 500 || state.committed || !state.rolledBack {
		t.Fatal("failed deletion must roll back")
	}
	state.failWrites = false
	response = callAccountHandler(DeleteAccount, `{"current_password":"current-password"}`)
	if response.Code != 200 || !state.committed {
		t.Fatalf("confirmed deletion failed: %d %s", response.Code, response.Body)
	}
}

func TestGoogleDeletionConfirmationRequiresSameRecentGoogleIdentity(t *testing.T) {
	valid := firebaseauth.Token{UID: "owner", AuthTime: time.Now().Unix(), Firebase: firebaseauth.FirebaseInfo{SignInProvider: "google.com"}}
	if !matchesGoogleConfirmation(&valid, "owner") {
		t.Fatal("recent matching Google identity should be accepted")
	}
	if matchesGoogleConfirmation(nil, "owner") || matchesGoogleConfirmation(&valid, "other") {
		t.Fatal("accepted missing or different identity")
	}
	stale := valid
	stale.AuthTime = time.Now().Unix() - 301
	future := valid
	future.AuthTime = time.Now().Unix() + 60
	password := valid
	password.Firebase.SignInProvider = "password"
	for _, token := range []*firebaseauth.Token{&stale, &future, &password} {
		if matchesGoogleConfirmation(token, "owner") {
			t.Fatal("accepted stale, future, or non-Google confirmation")
		}
	}
}
