// Package history persists the per-collection "last 100 opened requests"
// list. Files live in the user config dir, keyed by a hash of the
// collection root — never inside the collection itself.
package history

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
)

// Max is the history cap per collection root.
const Max = 100

func filePath(root string) (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	sum := sha1.Sum([]byte(root))
	return filepath.Join(dir, "primrose", "history", hex.EncodeToString(sum[:])+".json"), nil
}

// Save writes the history list (newest first), capped at Max.
func Save(root string, paths []string) error {
	p, err := filePath(root)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	if len(paths) > Max {
		paths = paths[:Max]
	}
	data, err := json.Marshal(paths)
	if err != nil {
		return err
	}
	return os.WriteFile(p, data, 0o644)
}

// Load returns the saved history, pruned of entries whose request files no
// longer exist. A missing or corrupt history file yields an empty list.
func Load(root string) ([]string, error) {
	p, err := filePath(root)
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(p)
	if os.IsNotExist(err) {
		return []string{}, nil
	}
	if err != nil {
		return nil, err
	}
	var paths []string
	if err := json.Unmarshal(data, &paths); err != nil {
		return []string{}, nil // corrupt history: start fresh
	}
	kept := make([]string, 0, len(paths))
	for _, fp := range paths {
		if _, err := os.Stat(fp); err == nil {
			kept = append(kept, fp)
		}
	}
	return kept, nil
}
