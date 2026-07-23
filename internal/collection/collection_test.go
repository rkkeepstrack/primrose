package collection

import (
	"encoding/json"
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
