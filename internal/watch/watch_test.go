package watch

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func newTestService(t *testing.T) (*Service, chan string) {
	t.Helper()
	changes := make(chan string, 10)
	s, err := New(func(root string) { changes <- root })
	if err != nil {
		t.Fatal(err)
	}
	s.debounce = 30 * time.Millisecond
	t.Cleanup(func() { s.Close() })
	return s, changes
}

func expectChange(t *testing.T, changes chan string, root string) {
	t.Helper()
	select {
	case got := <-changes:
		if got != root {
			t.Fatalf("change for %q, want %q", got, root)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("no change notification")
	}
}

func TestNotifiesOnFileChange(t *testing.T) {
	root := t.TempDir()
	s, changes := newTestService(t)
	if err := s.AddRoot(root); err != nil {
		t.Fatal(err)
	}

	os.WriteFile(filepath.Join(root, "req.toml"), []byte("method = \"GET\"\n"), 0o644)
	expectChange(t, changes, root)
}

func TestDebouncesBursts(t *testing.T) {
	root := t.TempDir()
	s, changes := newTestService(t)
	s.AddRoot(root)

	for i := range 10 {
		os.WriteFile(filepath.Join(root, "a.toml"), []byte{byte('0' + i)}, 0o644)
	}
	expectChange(t, changes, root)
	// the burst must have collapsed into one notification
	select {
	case <-changes:
		t.Fatal("burst produced a second notification")
	case <-time.After(150 * time.Millisecond):
	}
}

func TestWatchesNewSubdirs(t *testing.T) {
	root := t.TempDir()
	s, changes := newTestService(t)
	s.AddRoot(root)

	sub := filepath.Join(root, "newdir")
	os.Mkdir(sub, 0o755)
	expectChange(t, changes, root)

	// files inside the new dir must be seen too
	os.WriteFile(filepath.Join(sub, "req.toml"), []byte("x"), 0o644)
	expectChange(t, changes, root)
}

func TestIgnoresHiddenDirs(t *testing.T) {
	root := t.TempDir()
	git := filepath.Join(root, ".git")
	os.Mkdir(git, 0o755)
	s, changes := newTestService(t)
	s.AddRoot(root)

	os.WriteFile(filepath.Join(git, "index"), []byte("x"), 0o644)
	select {
	case <-changes:
		t.Fatal(".git churn should not notify")
	case <-time.After(150 * time.Millisecond):
	}
}
