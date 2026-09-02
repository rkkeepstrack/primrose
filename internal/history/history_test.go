package history

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

// touchFile creates an empty file (with parent dirs) and returns its path.
func touchFile(t *testing.T, dir, name string) string {
	t.Helper()
	p := filepath.Join(dir, name)
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, nil, 0o644); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestLoadWithoutHistoryFile(t *testing.T) {
	isolateConfigDir(t)
	paths, err := Load("/some/collection")
	if err != nil {
		t.Fatal(err)
	}
	if paths == nil || len(paths) != 0 {
		t.Errorf("want empty non-nil list, got %#v", paths)
	}
}

func TestSaveLoadRoundTripPrunesMissingFiles(t *testing.T) {
	dir := isolateConfigDir(t)
	root := filepath.Join(dir, "col")
	kept := touchFile(t, root, "auth/login.toml")
	gone := filepath.Join(root, "auth/deleted.toml") // never created
	if err := Save(root, []string{kept, gone}); err != nil {
		t.Fatal(err)
	}
	out, err := Load(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != 1 || out[0] != kept {
		t.Errorf("want only the existing file kept, got %#v", out)
	}
}

func TestSaveCapsAtMax(t *testing.T) {
	dir := isolateConfigDir(t)
	root := filepath.Join(dir, "col")
	paths := make([]string, 0, Max+5)
	for i := 0; i < Max+5; i++ {
		paths = append(paths, touchFile(t, root, filepath.Join("r", string(rune('a'+i%26))+string(rune('a'+i/26))+".toml")))
	}
	if err := Save(root, paths); err != nil {
		t.Fatal(err)
	}
	out, err := Load(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != Max {
		t.Errorf("want %d entries after save, got %d", Max, len(out))
	}
	if out[0] != paths[0] {
		t.Errorf("cap must keep the newest (front) entries, got first %q", out[0])
	}
}

func TestLoadCorruptHistoryFallsBack(t *testing.T) {
	dir := isolateConfigDir(t)
	root := filepath.Join(dir, "col")
	p := touchFile(t, root, "a.toml")
	if err := Save(root, []string{p}); err != nil {
		t.Fatal(err)
	}
	// corrupt the file in place
	fp, err := filePath(root)
	if err != nil {
		t.Fatal(err)
	}
	os.WriteFile(fp, []byte("{not json"), 0o644)

	out, err := Load(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != 0 {
		t.Errorf("corrupt history should fall back to empty, got %#v", out)
	}
}

func TestDifferentRootsDoNotCollide(t *testing.T) {
	dir := isolateConfigDir(t)
	rootA, rootB := filepath.Join(dir, "a"), filepath.Join(dir, "b")
	pa := touchFile(t, rootA, "x.toml")
	pb := touchFile(t, rootB, "y.toml")
	if err := Save(rootA, []string{pa}); err != nil {
		t.Fatal(err)
	}
	if err := Save(rootB, []string{pb}); err != nil {
		t.Fatal(err)
	}
	outA, _ := Load(rootA)
	outB, _ := Load(rootB)
	if len(outA) != 1 || outA[0] != pa || len(outB) != 1 || outB[0] != pb {
		t.Errorf("roots collided: %#v / %#v", outA, outB)
	}
}
