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
type Environment struct {
	Name string            `json:"name"`
	Path string            `json:"path"`
	Vars map[string]string `json:"vars"`
}

type envFile struct {
	Vars map[string]string `toml:"vars"`
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
		envs = append(envs, Environment{
			Name: strings.TrimSuffix(e.Name(), ".toml"),
			Path: path,
			Vars: f.Vars,
		})
	}
	sort.Slice(envs, func(i, j int) bool {
		return strings.ToLower(envs[i].Name) < strings.ToLower(envs[j].Name)
	})
	return envs, nil
}

// Save writes an environment file (creating environments/ if needed).
func Save(root, name string, vars map[string]string) error {
	dir := filepath.Join(root, dirName)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}

	var b strings.Builder
	b.WriteString("[vars]\n")
	keys := make([]string, 0, len(vars))
	for k := range vars {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		fmt.Fprintf(&b, "%s = %s\n", tomlutil.Key(k), tomlutil.String(vars[k]))
	}
	return os.WriteFile(filepath.Join(dir, name+".toml"), []byte(b.String()), 0o644)
}
