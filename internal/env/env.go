package env

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/BurntSushi/toml"

	"primrose/internal/tomlutil"
)

// Environment is one file in a collection's environments/ directory.
// Headers are environment-wide defaults inherited by every request while
// this environment is active (auth lives here, typically).
type Environment struct {
	Name    string            `json:"name"`
	Path    string            `json:"path"`
	Vars    map[string]string `json:"vars"`
	Headers map[string]string `json:"headers"`
}

type envFile struct {
	Vars    map[string]string `toml:"vars"`
	Headers map[string]string `toml:"headers"`
}

const dirName = "environments"

// List loads all environments of a collection, sorted by name.
func List(root string) ([]Environment, error) {
	dir := filepath.Join(root, dirName)
	entries, err := os.ReadDir(dir)
	if os.IsNotExist(err) {
		return []Environment{}, nil
	}
	if err != nil {
		return nil, err
	}

	envs := []Environment{}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".toml") {
			continue
		}
		path := filepath.Join(dir, e.Name())
		var f envFile
		if _, err := toml.DecodeFile(path, &f); err != nil {
			return nil, fmt.Errorf("reading %s: %w", e.Name(), err)
		}
		if f.Vars == nil {
			f.Vars = map[string]string{}
		}
		if f.Headers == nil {
			f.Headers = map[string]string{}
		}
		envs = append(envs, Environment{
			Name:    strings.TrimSuffix(e.Name(), ".toml"),
			Path:    path,
			Vars:    f.Vars,
			Headers: f.Headers,
		})
	}
	sort.Slice(envs, func(i, j int) bool {
		return strings.ToLower(envs[i].Name) < strings.ToLower(envs[j].Name)
	})
	return envs, nil
}

// Save writes an environment file (creating environments/ if needed).
// The name is sanitized to a safe filename.
func Save(root, name string, vars, headers map[string]string) error {
	name = strings.Trim(strings.Map(func(c rune) rune {
		switch c {
		case '/', '\\', ':', 0:
			return '-'
		}
		return c
	}, strings.TrimSpace(name)), ". ")
	if name == "" {
		return fmt.Errorf("environment name must not be empty")
	}
	dir := filepath.Join(root, dirName)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}

	var b strings.Builder
	writeSection := func(section string, m map[string]string) {
		fmt.Fprintf(&b, "[%s]\n", section)
		keys := make([]string, 0, len(m))
		for k := range m {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			fmt.Fprintf(&b, "%s = %s\n", tomlutil.Key(k), tomlutil.String(m[k]))
		}
	}
	writeSection("vars", vars)
	if len(headers) > 0 {
		b.WriteString("\n")
		writeSection("headers", headers)
	}
	return os.WriteFile(filepath.Join(dir, name+".toml"), []byte(b.String()), 0o644)
}

// path of an environment file.
func envPath(root, name string) string {
	return filepath.Join(root, dirName, name+".toml")
}

// Delete removes an environment file.
func Delete(root, name string) error {
	return os.Remove(envPath(root, name))
}

// Rename renames an environment, refusing to overwrite.
func Rename(root, oldName, newName string) error {
	newName = strings.TrimSpace(newName)
	if newName == "" {
		return fmt.Errorf("environment name must not be empty")
	}
	dest := envPath(root, newName)
	if _, err := os.Stat(dest); err == nil {
		return fmt.Errorf("an environment named %q already exists", newName)
	}
	return os.Rename(envPath(root, oldName), dest)
}

// Duplicate copies an environment to "<name>-copy" (then "-copy-2", …) and
// returns the new name.
func Duplicate(root, name string) (string, error) {
	data, err := os.ReadFile(envPath(root, name))
	if err != nil {
		return "", err
	}
	newName := name + "-copy"
	for n := 2; ; n++ {
		if _, err := os.Stat(envPath(root, newName)); os.IsNotExist(err) {
			break
		}
		newName = fmt.Sprintf("%s-copy-%d", name, n)
	}
	return newName, os.WriteFile(envPath(root, newName), data, 0o644)
}
