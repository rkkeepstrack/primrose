package collection

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/BurntSushi/toml"
)

// Node is one entry in the sidebar tree.
type Node struct {
	Name     string  `json:"name"` // display name (filename without .toml for requests)
	Path     string  `json:"path"` // absolute path on disk
	IsFolder bool    `json:"isFolder"`
	Method   string  `json:"method,omitempty"` // set for requests
	Children []*Node `json:"children,omitempty"`
}

// Body of a request.
type Body struct {
	Type    string `toml:"type" json:"type"` // "json" | "text"
	Content string `toml:"content" json:"content"`
}

// Tests holds the request's post-response Starlark assertion script.
type Tests struct {
	Script string `toml:"script" json:"script"`
}

// Request mirrors a request .toml file.
type Request struct {
	Method string            `toml:"method" json:"method"`
	URL    string            `toml:"url" json:"url"`
	Query  map[string]string `toml:"query" json:"query"`
	// query keys switched off in the UI: kept in [query] with their value,
	// left out of the URL and the sent request
	DisabledQuery []string          `toml:"disabled_query" json:"disabledQuery"`
	Headers       map[string]string `toml:"headers" json:"headers"`
	Body          Body              `toml:"body" json:"body"`
	// values for the request's :dynamic variables — request-scoped
	// equivalents of environment variables
	Vars map[string]string `toml:"vars" json:"vars"`
	// post-response assertions, run sandboxed after a send
	Tests Tests `toml:"tests" json:"tests"`
}

// Collection is an opened collection folder.
type Collection struct {
	Name string  `json:"name"`
	Root string  `json:"root"`
	Tree []*Node `json:"tree"`
}

const manifestFile = "primrose.toml"

// Open loads a collection folder. The folder's own name is the collection
// name; primrose.toml is only the marker that makes a folder a collection
// (created on first open if missing).
func Open(root string) (*Collection, error) {
	info, err := os.Stat(root)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("%s is not a directory", root)
	}

	manifestPath := filepath.Join(root, manifestFile)
	if _, err := os.Stat(manifestPath); os.IsNotExist(err) {
		marker := "# marks this folder as a primrose collection\n"
		if err := os.WriteFile(manifestPath, []byte(marker), 0o644); err != nil {
			return nil, err
		}
	}

	tree, err := scanDir(root)
	if err != nil {
		return nil, err
	}
	if tree == nil {
		tree = []*Node{} // an empty collection must serialize as [], not null
	}
	return &Collection{Name: filepath.Base(root), Root: root, Tree: tree}, nil
}

// MergeHeaders layers request headers over collection defaults. Header names
// compare case-insensitively; a request header with an empty value removes
// the inherited header entirely.
func MergeHeaders(inherited, own map[string]string) map[string]string {
	out := make(map[string]string, len(inherited)+len(own))
	for k, v := range inherited {
		out[k] = v
	}
	for k, v := range own {
		for ik := range out {
			if strings.EqualFold(ik, k) {
				delete(out, ik)
			}
		}
		if v != "" {
			out[k] = v
		}
	}
	return out
}

// scanDir builds the tree for one directory level, folders first,
// each group sorted alphabetically (case-insensitive).
func scanDir(dir string) ([]*Node, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var folders, requests []*Node
	for _, e := range entries {
		name := e.Name()
		if strings.HasPrefix(name, ".") {
			continue
		}
		path := filepath.Join(dir, name)
		if e.IsDir() {
			if name == "environments" && isCollectionRoot(dir) {
				continue // reserved for env files, not part of the request tree
			}
			children, err := scanDir(path)
			if err != nil {
				return nil, err
			}
			folders = append(folders, &Node{Name: name, Path: path, IsFolder: true, Children: children})
			continue
		}
		if name == manifestFile || !strings.HasSuffix(name, ".toml") {
			continue
		}
		method := peekMethod(path)
		requests = append(requests, &Node{
			Name:   strings.TrimSuffix(name, ".toml"),
			Path:   path,
			Method: method,
		})
	}

	byName := func(nodes []*Node) func(i, j int) bool {
		return func(i, j int) bool {
			return strings.ToLower(nodes[i].Name) < strings.ToLower(nodes[j].Name)
		}
	}
	sort.Slice(folders, byName(folders))
	sort.Slice(requests, byName(requests))
	return append(folders, requests...), nil
}

func isCollectionRoot(dir string) bool {
	_, err := os.Stat(filepath.Join(dir, manifestFile))
	return err == nil
}

// peekMethod reads just the method from a request file for the tree badge.
func peekMethod(path string) string {
	var r struct {
		Method string `toml:"method"`
	}
	if _, err := toml.DecodeFile(path, &r); err != nil {
		return "?"
	}
	if r.Method == "" {
		return "?"
	}
	return strings.ToUpper(r.Method)
}

// ReadRequest loads a full request file.
func ReadRequest(path string) (*Request, error) {
	var r Request
	if _, err := toml.DecodeFile(path, &r); err != nil {
		return nil, err
	}
	r.Method = strings.ToUpper(r.Method)
	if r.Method == "" {
		r.Method = "GET"
	}
	if r.Query == nil {
		r.Query = map[string]string{}
	}
	if r.Headers == nil {
		r.Headers = map[string]string{}
	}
	if r.Body.Type == "" {
		r.Body.Type = "json"
	}
	return &r, nil
}
