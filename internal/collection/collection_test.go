package collection

import (
	"encoding/json"
	"os"
	"testing"
)

func TestOpenSampleCollection(t *testing.T) {
	col, err := Open("../../sample-collection")
	if err != nil {
		t.Fatal(err)
	}
	if col.Name != "Sample Collection" {
		t.Errorf("name = %q", col.Name)
	}
	b, _ := json.MarshalIndent(col.Tree, "", "  ")
	t.Logf("tree:\n%s", b)

	// folders first, then requests; environments/ excluded
	if len(col.Tree) != 2 {
		t.Fatalf("expected 2 root nodes, got %d", len(col.Tree))
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
	if got.URL != orig.URL || got.Query["b c"] != "two words" || got.Body.Content != orig.Body.Content+"\n" && got.Body.Content != orig.Body.Content {
		t.Errorf("round trip mismatch:\norig: %+v\ngot:  %+v", orig, got)
	}
	raw, _ := os.ReadFile(tmp)
	t.Logf("file:\n%s", raw)
}
