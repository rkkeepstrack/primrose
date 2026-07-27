package collection

import (
	"os"
	"path/filepath"
	"testing"
)

// newFixture builds a small collection on disk:
//
//	root/
//	├── primrose.toml
//	├── environments/staging.toml   (excluded from the tree)
//	├── get-teasers.toml
//	└── teasers/create-teaser.toml
func newFixture(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "primrose.toml"), "name = \"Fixture\"\n")
	writeFile(t, filepath.Join(root, "environments", "staging.toml"),
		"[vars]\ncms_api_url = \"https://staging.example.com\"\n")
	writeFile(t, filepath.Join(root, "get-teasers.toml"),
		"method = \"GET\"\nurl = \"{{cms_api_url}}/teasers\"\n\n[query]\nteaserGalleryId = \"500070228\"\n")
	writeFile(t, filepath.Join(root, "teasers", "create-teaser.toml"),
		"method = \"POST\"\nurl = \"{{cms_api_url}}/teasers\"\n\n[headers]\nContent-Type = \"application/json\"\n\n[body]\ntype = \"json\"\ncontent = '''\n{ \"title\": \"hi\" }\n'''\n")
	return root
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestOpen(t *testing.T) {
	root := newFixture(t)
	col, err := Open(root)
	if err != nil {
		t.Fatal(err)
	}
	if col.Name != filepath.Base(root) {
		t.Errorf("name should be the folder name, got %q", col.Name)
	}
	// folders first, then requests; environments/ excluded
	if len(col.Tree) != 2 {
		t.Fatalf("expected 2 root nodes, got %d", len(col.Tree))
	}
	for _, n := range col.Tree {
		if n.Name == "environments" {
			t.Error("environments/ must not appear in the tree")
		}
	}
	if !col.Tree[0].IsFolder || col.Tree[0].Name != "teasers" {
		t.Errorf("first node should be teasers folder, got %+v", col.Tree[0])
	}
	if col.Tree[1].Method != "GET" || col.Tree[1].Name != "get-teasers" {
		t.Errorf("second node should be GET get-teasers, got %+v", col.Tree[1])
	}

	r, err := ReadRequest(col.Tree[0].Children[0].Path)
	if err != nil {
		t.Fatal(err)
	}
	if r.Method != "POST" || r.Body.Type != "json" || r.Headers["Content-Type"] != "application/json" {
		t.Errorf("unexpected request: %+v", r)
	}
}

func TestOpenCreatesManifest(t *testing.T) {
	root := t.TempDir()
	col, err := Open(root)
	if err != nil {
		t.Fatal(err)
	}
	if col.Name != filepath.Base(root) {
		t.Errorf("name should default to folder name, got %q", col.Name)
	}
	if _, err := os.Stat(filepath.Join(root, "primrose.toml")); err != nil {
		t.Error("manifest should have been created")
	}
}

func TestWriteRequestRoundTrip(t *testing.T) {
	tmp := t.TempDir() + "/req.toml"
	orig := &Request{
		Method:  "POST",
		URL:     "{{base}}/things?x=1",
		Query:   map[string]string{"a": "1", "b c": "two words"},
		Headers: map[string]string{"Content-Type": "application/json"},
		Body:    Body{Type: "json", Content: "{\n  \"k\": \"v\"\n}"},
	}
	if err := WriteRequest(tmp, orig); err != nil {
		t.Fatal(err)
	}
	got, err := ReadRequest(tmp)
	if err != nil {
		t.Fatal(err)
	}
	if got.URL != orig.URL || got.Query["b c"] != "two words" {
		t.Errorf("round trip mismatch:\norig: %+v\ngot:  %+v", orig, got)
	}
	if got.Body.Content != orig.Body.Content && got.Body.Content != orig.Body.Content+"\n" {
		t.Errorf("body mismatch: %q", got.Body.Content)
	}
}

// Escaping edge cases: values that are invalid TOML with naive Go quoting.
func TestWriteRequestEscaping(t *testing.T) {
	tmp := t.TempDir() + "/esc.toml"
	orig := &Request{
		Method: "POST",
		URL:    "https://x.io/päth?q=ümlaut",
		Headers: map[string]string{
			"X-Weird":   "tab\there \"quoted\" back\\slash",
			"X-Control": "bell\x07end",
		},
		Body: Body{Type: "text", Content: "contains ''' triple quotes\nand a second line"},
	}
	if err := WriteRequest(tmp, orig); err != nil {
		t.Fatal(err)
	}
	got, err := ReadRequest(tmp)
	if err != nil {
		t.Fatalf("wrote invalid TOML: %v", err)
	}
	if got.Headers["X-Weird"] != orig.Headers["X-Weird"] {
		t.Errorf("weird header: %q", got.Headers["X-Weird"])
	}
	if got.Headers["X-Control"] != orig.Headers["X-Control"] {
		t.Errorf("control header: %q", got.Headers["X-Control"])
	}
	if got.URL != orig.URL {
		t.Errorf("unicode url: %q", got.URL)
	}
	if got.Body.Content != orig.Body.Content {
		t.Errorf("triple-quote body: %q", got.Body.Content)
	}
}
