package exchange

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"primrose/internal/collection"
)

func TestDoResolvesSendsAndRunsTests(t *testing.T) {
	var gotAuth, gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth, gotPath = r.Header.Get("Authorization"), r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"ok":true}`)
	}))
	defer srv.Close()

	r := collection.Request{
		Method:  "GET",
		URL:     "{{base}}/things/:id",
		Headers: map[string]string{"X-Own": "1"},
		Tests:   collection.Tests{Script: "assert res.status == 200\nassert res.body[\"ok\"] == {{expected}}"},
	}
	resp, err := Do(context.Background(), r,
		map[string]string{"base": srv.URL, "expected": "True"},
		map[string]string{"id": "7"},
		map[string]string{"Authorization": "Bearer t"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if gotPath != "/things/7" || gotAuth != "Bearer t" {
		t.Errorf("sent path %q auth %q", gotPath, gotAuth)
	}
	if resp.Tests == nil || resp.Tests.Passed != 2 || resp.Tests.Total != 2 {
		t.Errorf("tests = %+v", resp.Tests)
	}
}

func TestDoSkipsTestsWithoutScript(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer srv.Close()
	resp, err := Do(context.Background(), collection.Request{Method: "GET", URL: srv.URL}, nil, nil, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if resp.Tests != nil {
		t.Errorf("no script, but tests = %+v", resp.Tests)
	}
}
