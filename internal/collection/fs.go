package collection

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// CreateFolder creates a new subfolder and returns its path.
func CreateFolder(dir, name string) (string, error) {
	name = sanitizeName(name)
	if name == "" {
		return "", fmt.Errorf("folder name must not be empty")
	}
	path := filepath.Join(dir, name)
	if _, err := os.Stat(path); err == nil {
		return "", fmt.Errorf("%q already exists here", name)
	}
	if err := os.Mkdir(path, 0o755); err != nil {
		return "", err
	}
	return path, nil
}

// MoveItem moves a request file or folder into destDir and returns the new
// path. It refuses to overwrite and to move a folder into itself.
func MoveItem(src, destDir string) (string, error) {
	base := filepath.Base(src)
	dest := filepath.Join(destDir, base)
	if dest == src {
		return src, nil
	}
	if strings.HasPrefix(destDir+string(os.PathSeparator), src+string(os.PathSeparator)) {
		return "", fmt.Errorf("cannot move a folder into itself")
	}
	if _, err := os.Stat(dest); err == nil {
		return "", fmt.Errorf("%q already exists in the target folder", base)
	}
	if err := os.Rename(src, dest); err != nil {
		return "", err
	}
	return dest, nil
}
