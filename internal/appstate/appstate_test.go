package appstate

import (
	"os"
	"path/filepath"
	"testing"
)

func isolateConfigDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("HOME", dir) // darwin: UserConfigDir = $HOME/Library/Application Support
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(dir, ".config"))
	return dir
}

func TestLoadWithoutStateFile(t *testing.T) {
	isolateConfigDir(t)
	s, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if s.OpenRoots == nil || len(s.OpenRoots) != 0 {
		t.Errorf("want empty non-nil roots, got %#v", s.OpenRoots)
	}
}

func TestSaveLoadRoundTrip(t *testing.T) {
	isolateConfigDir(t)
	in := &State{OpenRoots: []string{"/a", "/b"}, ActiveRoot: "/b"}
	if err := Save(in); err != nil {
		t.Fatal(err)
	}
	out, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if len(out.OpenRoots) != 2 || out.OpenRoots[1] != "/b" || out.ActiveRoot != "/b" {
		t.Errorf("round trip: %#v", out)
	}
}

func TestLoadCorruptStateFallsBack(t *testing.T) {
	isolateConfigDir(t)
	if err := Save(&State{OpenRoots: []string{"/a"}}); err != nil {
		t.Fatal(err)
	}
	// corrupt the file in place
	dir, _ := os.UserConfigDir()
	path := filepath.Join(dir, "primrose", "state.json")
	os.WriteFile(path, []byte("{not json"), 0o644)

	s, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if len(s.OpenRoots) != 0 {
		t.Errorf("corrupt state should fall back to empty, got %#v", s)
	}
}
