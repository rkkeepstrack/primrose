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
	if err := Save(root, "staging", vars, map[string]string{"Authorization": "Bearer {{token}}"}); err != nil {
		t.Fatal(err)
	}
	if err := Save(root, "production", map[string]string{"cms_api_url": "https://prod"}, nil); err != nil {
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
	if err := Save(root, "staging", map[string]string{"a": "1"}, nil); err != nil {
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
