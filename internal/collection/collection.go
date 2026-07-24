package collection

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/BurntSushi/toml"
)

// Manifest is the primrose.toml at a collection root.
type Manifest struct {
	Name string `toml:"name" json:"name"`
}

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

// Request mirrors a request .toml file.
type Request struct {
	Method  string            `toml:"method" json:"method"`
	URL     string            `toml:"url" json:"url"`
	Query   map[string]string `toml:"query" json:"query"`
	Headers map[string]string `toml:"headers" json:"headers"`
	Body    Body              `toml:"body" json:"body"`
}

// Collection is an opened collection folder.
type Collection struct {
	Name string  `json:"name"`
	Root string  `json:"root"`
	Tree []*Node `json:"tree"`
}

const manifestFile = "primrose.toml"

// Open loads a collection folder. If no primrose.toml exists yet, one is
// created so the folder is marked as a collection from then on.
func Open(root string) (*Collection, error) {
	info, err := os.Stat(root)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("%s is not a directory", root)
	}

	var m Manifest
	manifestPath := filepath.Join(root, manifestFile)
	if _, err := toml.DecodeFile(manifestPath, &m); err != nil {
		if !os.IsNotExist(err) {
			return nil, fmt.Errorf("reading %s: %w", manifestFile, err)
		}
		m.Name = filepath.Base(root)
		if err := writeManifest(manifestPath, m); err != nil {
			return nil, err
		}
	}
	if m.Name == "" {
		m.Name = filepath.Base(root)
	}

	tree, err := scanDir(root)
	if err != nil {
		return nil, err
	}
	return &Collection{Name: m.Name, Root: root, Tree: tree}, nil
}

func writeManifest(path string, m Manifest) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return toml.NewEncoder(f).Encode(m)
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
