package httpclient

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"primrose/internal/collection"
)

func TestSlashQueryValueArrives(t *testing.T) {
	var gotRawQuery, gotURI string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotRawQuery = r.URL.RawQuery
		gotURI = r.RequestURI
		if r.URL.Query().Get("path") == "" {
			t.Errorf("server: parameter path is missing (RawQuery=%q)", r.URL.RawQuery)
		}
	}))
	defer srv.Close()

	// exactly the UI state: url carries the query, [query] map mirrors it
	req := &collection.Request{
		Method: "GET",
		URL:    srv.URL + "/api/v1/hb/content?path=/",
		Query:  map[string]string{"path": "/"},
	}
	resolved := collection.Resolve(req, map[string]string{}, map[string]string{})
	if _, err := Send(resolved); err != nil {
		t.Fatal(err)
	}
	if gotRawQuery != "path=%2F" {
		t.Errorf("RawQuery = %q, want path=%%2F (encoded so redirect proxies keep it)", gotRawQuery)
	}
	_ = gotURI
}

func TestNormalizeQuery(t *testing.T) {
	cases := map[string]string{
		"http://x/api?path=/":    "http://x/api?path=%2F",
		"http://x/api?path=%2F":  "http://x/api?path=%2F",
		"http://x/api?a=1&b=c/d": "http://x/api?a=1&b=c%2Fd",
		"http://x/api":           "http://x/api",
		"http://x/api?flag":      "http://x/api?flag",
		"http://x/api?bad=%zz":   "http://x/api?bad=%zz",
	}
	for in, want := range cases {
		if got := normalizeQuery(in); got != want {
			t.Errorf("normalizeQuery(%q) = %q, want %q", in, got, want)
		}
	}
}
