package env

import (
	"os"
	"path/filepath"
	"testing"
)

func TestListEmptyWhenNoDir(t *testing.T) {
	envs, err := List(t.TempDir())
	if err != nil || len(envs) != 0 {
		t.Fatalf("want empty list, got %v, %v", envs, err)
	}
}

func TestSaveAndListRoundTrip(t *testing.T) {
	root := t.TempDir()
	vars := map[string]string{
		"cms_api_url": "https://staging.example.com",
		"weird key":   "value with \"quotes\" and\nnewline",
	}
	if err := Save(root, "staging", vars, map[string]string{"Authorization": "Bearer {{token}}"}, nil); err != nil {
		t.Fatal(err)
	}
	if err := Save(root, "production", map[string]string{"cms_api_url": "https://prod"}, nil, nil); err != nil {
		t.Fatal(err)
	}

	envs, err := List(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(envs) != 2 {
		t.Fatalf("want 2 envs, got %d", len(envs))
	}
	// sorted by name: production, staging
	if envs[0].Name != "production" || envs[1].Name != "staging" {
		t.Errorf("order: %s, %s", envs[0].Name, envs[1].Name)
	}
	if envs[1].Vars["weird key"] != vars["weird key"] {
		t.Errorf("escaping round trip: %q", envs[1].Vars["weird key"])
	}
	if envs[1].Headers["Authorization"] != "Bearer {{token}}" {
		t.Errorf("headers round trip: %v", envs[1].Headers)
	}
	if len(envs[0].Headers) != 0 {
		t.Errorf("headers should default to empty, got %v", envs[0].Headers)
	}
}

func TestListSkipsNonToml(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "environments")
	os.MkdirAll(dir, 0o755)
	os.WriteFile(filepath.Join(dir, "notes.txt"), []byte("hi"), 0o644)
	os.WriteFile(filepath.Join(dir, "a.toml"), []byte("[vars]\nx = \"1\"\n"), 0o644)

	envs, err := List(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(envs) != 1 || envs[0].Name != "a" {
		t.Fatalf("want just 'a', got %v", envs)
	}
}

func TestDeleteRenameDuplicate(t *testing.T) {
	root := t.TempDir()
	if err := Save(root, "staging", map[string]string{"a": "1"}, nil, nil); err != nil {
		t.Fatal(err)
	}

	dup, err := Duplicate(root, "staging")
	if err != nil || dup != "staging-copy" {
		t.Fatalf("dup = %q, %v", dup, err)
	}
	dup2, _ := Duplicate(root, "staging")
	if dup2 != "staging-copy-2" {
		t.Errorf("dup2 = %q", dup2)
	}

	if err := Rename(root, "staging-copy-2", "prod"); err != nil {
		t.Fatal(err)
	}
	if err := Rename(root, "prod", "staging"); err == nil {
		t.Error("rename onto existing env should fail")
	}

	if err := Delete(root, "prod"); err != nil {
		t.Fatal(err)
	}
	envs, _ := List(root)
	if len(envs) != 2 {
		t.Errorf("want staging + staging-copy, got %v", envs)
	}
}

func TestListMergesSecrets(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "environments")
	os.MkdirAll(dir, 0o755)
	os.WriteFile(filepath.Join(dir, "staging.toml"), []byte(
		"[vars]\napi_url = \"https://api.staging\"\n\n[secrets]\nvars = [\"api_token\", \"db_pass\"]\n",
	), 0o644)
	os.WriteFile(filepath.Join(dir, "staging.secrets.toml"), []byte(
		"api_token = \"sk-abc123\"\n",
	), 0o644)

	envs, err := List(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(envs) != 1 || envs[0].Name != "staging" {
		t.Fatalf("secrets file must not list as an environment: %v", envs)
	}
	e := envs[0]
	if e.Vars["api_token"] != "sk-abc123" {
		t.Errorf("secret value not merged: %q", e.Vars["api_token"])
	}
	if e.Vars["api_url"] != "https://api.staging" {
		t.Errorf("normal var lost: %q", e.Vars["api_url"])
	}
	if v, ok := e.Vars["db_pass"]; !ok || v != "" {
		t.Errorf("missing secret should resolve to empty string, got %q ok=%v", v, ok)
	}
	if len(e.Secrets) != 2 || e.Secrets[0] != "api_token" || e.Secrets[1] != "db_pass" {
		t.Errorf("declared secrets: %v", e.Secrets)
	}
	if len(e.MissingSecrets) != 1 || e.MissingSecrets[0] != "db_pass" {
		t.Errorf("missing secrets: %v", e.MissingSecrets)
	}
}

func TestListNoSecretsDeclared(t *testing.T) {
	root := t.TempDir()
	if err := Save(root, "prod", map[string]string{"a": "1"}, nil, nil); err != nil {
		t.Fatal(err)
	}
	envs, err := List(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(envs[0].Secrets) != 0 || len(envs[0].MissingSecrets) != 0 {
		t.Errorf("want empty (non-nil) secret slices, got %v / %v", envs[0].Secrets, envs[0].MissingSecrets)
	}
	if envs[0].Secrets == nil || envs[0].MissingSecrets == nil {
		t.Error("slices must be non-nil so JSON encodes [] not null")
	}
}

func TestListSecretOverridesVar(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "environments")
	os.MkdirAll(dir, 0o755)
	os.WriteFile(filepath.Join(dir, "staging.toml"), []byte(
		"[vars]\napi_token = \"plain-value\"\n\n[secrets]\nvars = [\"api_token\"]\n",
	), 0o644)
	os.WriteFile(filepath.Join(dir, "staging.secrets.toml"), []byte(
		"api_token = \"sk-secret\"\n",
	), 0o644)

	envs, err := List(root)
	if err != nil {
		t.Fatal(err)
	}
	if got := envs[0].Vars["api_token"]; got != "sk-secret" {
		t.Errorf("secret should win over same-named [vars] entry, got %q", got)
	}
}
