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

// RenameItem renames a request file or folder in place, returns the new path.
func RenameItem(path, newName string) (string, error) {
	newName = sanitizeName(newName)
	if newName == "" {
		return "", fmt.Errorf("name must not be empty")
	}
	info, err := os.Stat(path)
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		newName += ".toml"
	}
	dest := filepath.Join(filepath.Dir(path), newName)
	if dest == path {
		return path, nil
	}
	if _, err := os.Stat(dest); err == nil {
		return "", fmt.Errorf("%q already exists here", newName)
	}
	if err := os.Rename(path, dest); err != nil {
		return "", err
	}
	return dest, nil
}

// DeleteItem removes a request file or a folder including its contents.
func DeleteItem(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return os.RemoveAll(path)
	}
	return os.Remove(path)
}

// DuplicateItem copies a request file or folder next to itself with a
// "-copy" (or "-copy-2", …) suffix and returns the new path.
func DuplicateItem(path string) (string, error) {
	info, err := os.Stat(path)
	if err != nil {
		return "", err
	}
	dir := filepath.Dir(path)
	base := filepath.Base(path)
	ext := ""
	if !info.IsDir() {
		ext = filepath.Ext(base)
		base = strings.TrimSuffix(base, ext)
	}
	// first free name wins: "x-copy", then "x-copy-2", "x-copy-3", …
	dest := filepath.Join(dir, base+"-copy"+ext)
	for n := 2; ; n++ {
		if _, err := os.Stat(dest); os.IsNotExist(err) {
			break
		}
		dest = filepath.Join(dir, fmt.Sprintf("%s-copy-%d%s", base, n, ext))
	}
	if info.IsDir() {
		return dest, copyDir(path, dest)
	}
	return dest, copyFile(path, dest)
}

func copyFile(src, dest string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dest, data, 0o644)
}

func copyDir(src, dest string) error {
	if err := os.MkdirAll(dest, 0o755); err != nil {
		return err
	}
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	for _, e := range entries {
		s := filepath.Join(src, e.Name())
		d := filepath.Join(dest, e.Name())
		if e.IsDir() {
			if err := copyDir(s, d); err != nil {
				return err
			}
		} else if err := copyFile(s, d); err != nil {
			return err
		}
	}
	return nil
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
