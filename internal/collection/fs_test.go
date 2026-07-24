package collection

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCreateFolderAndRequest(t *testing.T) {
	root := t.TempDir()

	dir, err := CreateFolder(root, "teasers")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := CreateFolder(root, "teasers"); err == nil {
		t.Error("duplicate folder should fail")
	}

	path, err := CreateRequest(dir, "get-all", &Request{Method: "GET", URL: "https://x.io"})
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(path) != "get-all.toml" {
		t.Errorf("path = %s", path)
	}
	if _, err := CreateRequest(dir, "get-all", &Request{}); err == nil {
		t.Error("overwriting existing request should fail")
	}
	if _, err := CreateRequest(dir, "  ", &Request{}); err == nil {
		t.Error("blank name should fail")
	}
}

func TestSanitizeNameBlocksTraversal(t *testing.T) {
	root := t.TempDir()
	path, err := CreateRequest(root, "../escape", &Request{Method: "GET"})
	if err != nil {
		t.Fatalf("sanitized create failed: %v", err)
	}
	rel, err := filepath.Rel(root, path)
	if err != nil || strings.HasPrefix(rel, "..") {
		t.Errorf("request escaped the root: %s", path)
	}
}

func TestMoveRenameDeleteDuplicate(t *testing.T) {
	root := t.TempDir()
	sub, _ := CreateFolder(root, "sub")
	path, _ := CreateRequest(root, "req", &Request{Method: "GET", URL: "https://x.io"})

	moved, err := MoveItem(path, sub)
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Dir(moved) != sub {
		t.Errorf("moved to %s", moved)
	}

	if _, err := MoveItem(sub, filepath.Join(sub)); err == nil {
		t.Error("moving folder into itself should fail")
	}

	renamed, err := RenameItem(moved, "renamed")
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(renamed) != "renamed.toml" {
		t.Errorf("renamed = %s", renamed)
	}

	dup, err := DuplicateItem(renamed)
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(dup) != "renamed-copy.toml" {
		t.Errorf("dup = %s", dup)
	}
	dup2, _ := DuplicateItem(renamed)
	if filepath.Base(dup2) != "renamed-copy-2.toml" {
		t.Errorf("dup2 = %s", dup2)
	}

	if err := DeleteItem(sub); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(sub); !os.IsNotExist(err) {
		t.Error("folder should be gone")
	}
}
