package collection

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"primrose/internal/tomlutil"
)

// CreateRequest creates a new request file named after name inside dir.
// The name is sanitized to a safe filename; an existing file is never
// overwritten.
func CreateRequest(dir, name string, r *Request) (string, error) {
	name = sanitizeName(name)
	if name == "" {
		return "", fmt.Errorf("request name must not be empty")
	}
	path := filepath.Join(dir, name+".toml")
	if _, err := os.Stat(path); err == nil {
		return "", fmt.Errorf("a request named %q already exists here", name)
	}
	if err := WriteRequest(path, r); err != nil {
		return "", err
	}
	return path, nil
}

// sanitizeName turns a display name into a safe filename.
func sanitizeName(name string) string {
	name = strings.TrimSpace(strings.TrimSuffix(name, ".toml"))
	name = strings.Map(func(c rune) rune {
		switch c {
		case '/', '\\', ':', 0:
			return '-'
		}
		return c
	}, name)
	return strings.Trim(name, ". ")
}

// WriteRequest serializes a request to TOML by hand so the output stays
// stable and human-friendly: fixed section order, body content in a
// multi-line ”'...”' string.
func WriteRequest(path string, r *Request) error {
	var b strings.Builder

	fmt.Fprintf(&b, "method = %s\n", tomlutil.String(strings.ToUpper(r.Method)))
	fmt.Fprintf(&b, "url = %s\n", tomlutil.String(r.URL))

	writeSection := func(name string, m map[string]string) {
		if len(m) == 0 {
			return
		}
		fmt.Fprintf(&b, "\n[%s]\n", name)
		keys := make([]string, 0, len(m))
		for k := range m {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			fmt.Fprintf(&b, "%s = %s\n", tomlutil.Key(k), tomlutil.String(m[k]))
		}
	}
	writeSection("query", r.Query)
	writeSection("headers", r.Headers)
	writeSection("vars", r.Vars)

	if r.Body.Content != "" {
		b.WriteString("\n[body]\n")
		fmt.Fprintf(&b, "type = %s\n", tomlutil.String(r.Body.Type))
		if strings.Contains(r.Body.Content, "'''") {
			fmt.Fprintf(&b, "content = %s\n", tomlutil.String(r.Body.Content))
		} else {
			content := strings.TrimSuffix(r.Body.Content, "\n")
			fmt.Fprintf(&b, "content = '''\n%s\n'''\n", content)
		}
	}

	return os.WriteFile(path, []byte(b.String()), 0o644)
}
