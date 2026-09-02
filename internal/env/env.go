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
// Secrets lists the vars declared secret in the committed file; their
// values are merged into Vars from the gitignored <name>.secrets.toml.
// MissingSecrets are declared secrets with no local value (resolve to "").
type Environment struct {
	Name           string            `json:"name"`
	Path           string            `json:"path"`
	Vars           map[string]string `json:"vars"`
	Headers        map[string]string `json:"headers"`
	Secrets        []string          `json:"secrets"`
	MissingSecrets []string          `json:"missingSecrets"`
}

type envFile struct {
	Vars    map[string]string `toml:"vars"`
	Headers map[string]string `toml:"headers"`
	Secrets struct {
		Vars []string `toml:"vars"`
	} `toml:"secrets"`
}

const dirName = "environments"
const secretsSuffix = ".secrets.toml"

// path of an environment's gitignored secrets sibling file.
func secretsFilePath(root, name string) string {
	return filepath.Join(root, dirName, name+secretsSuffix)
}

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
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".toml") || strings.HasSuffix(e.Name(), secretsSuffix) {
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
		name := strings.TrimSuffix(e.Name(), ".toml")
		secretVals := map[string]string{}
		if _, err := toml.DecodeFile(secretsFilePath(root, name), &secretVals); err != nil && !os.IsNotExist(err) {
			return nil, fmt.Errorf("reading %s%s: %w", name, secretsSuffix, err)
		}
		secrets := f.Secrets.Vars
		if secrets == nil {
			secrets = []string{}
		}
		missing := []string{}
		for _, s := range secrets {
			if v, ok := secretVals[s]; ok {
				f.Vars[s] = v
			} else {
				f.Vars[s] = ""
				missing = append(missing, s)
			}
		}
		envs = append(envs, Environment{
			Name:           name,
			Path:           path,
			Vars:           f.Vars,
			Headers:        f.Headers,
			Secrets:        secrets,
			MissingSecrets: missing,
		})
	}
	sort.Slice(envs, func(i, j int) bool {
		return strings.ToLower(envs[i].Name) < strings.ToLower(envs[j].Name)
	})
	return envs, nil
}

// Save writes an environment file (creating environments/ if needed).
// The name is sanitized to a safe filename. Secret values go to the
// gitignored <name>.secrets.toml sibling; the committed file only lists
// their names.
func Save(root, name string, vars, headers, secrets map[string]string) error {
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
