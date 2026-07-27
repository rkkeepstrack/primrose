package httpclient

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"primrose/internal/collection"
)

func TestSend(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("teaserGalleryId") != "500070228" {
			t.Errorf("query not appended, got %s", r.URL.RawQuery)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("json content type not defaulted, got %q", r.Header.Get("Content-Type"))
		}
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		w.Header().Set("X-Test", "yes")
		w.WriteHeader(201)
		w.Write([]byte(`{"echo":"` + body["title"] + `"}`))
	}))
	defer srv.Close()

	resp, err := Send(&collection.Request{
		Method: "POST",
		URL:    srv.URL + "/teasers",
		Query:  map[string]string{"teaserGalleryId": "500070228"},
		Body:   collection.Body{Type: "json", Content: `{"title":"hi"}`},
	})
	if err != nil {
		t.Fatal(err)
	}
	if resp.Status != 201 || resp.StatusText != "Created" {
		t.Errorf("status = %d %s", resp.Status, resp.StatusText)
	}
	if resp.Headers["X-Test"] != "yes" {
		t.Errorf("headers = %v", resp.Headers)
	}
	if resp.Body != `{"echo":"hi"}` {
		t.Errorf("body = %s", resp.Body)
	}
	if resp.DurationMs < 0 || resp.Size != int64(len(resp.Body)) {
		t.Errorf("meta: %dms %dB", resp.DurationMs, resp.Size)
	}
}

func TestSendTextBodyContentType(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if ct := r.Header.Get("Content-Type"); ct != "text/plain" {
			t.Errorf("text body content type = %q", ct)
		}
	}))
	defer srv.Close()

	if _, err := Send(&collection.Request{
		Method: "POST",
		URL:    srv.URL,
		Body:   collection.Body{Type: "text", Content: "plain payload"},
	}); err != nil {
		t.Fatal(err)
	}
}

func TestUserAgentDefaultAndOverride(t *testing.T) {
	var got []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = append(got, r.Header.Get("User-Agent"))
	}))
	defer srv.Close()

	Send(&collection.Request{Method: "GET", URL: srv.URL})
	Send(&collection.Request{Method: "GET", URL: srv.URL, Headers: map[string]string{"User-Agent": "custom/1"}})
	if got[0] != "primrose/0.1" {
		t.Errorf("default UA = %q", got[0])
	}
	if got[1] != "custom/1" {
		t.Errorf("override UA = %q", got[1])
	}
}

func TestResponseCarriesRequestHeaders(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer srv.Close()

	resp, err := Send(&collection.Request{
		Method:  "POST",
		URL:     srv.URL + "/x",
		Headers: map[string]string{"X-Mine": "1"},
		Body:    collection.Body{Type: "json", Content: `{"a":1}`},
	})
	if err != nil {
		t.Fatal(err)
	}
	rh := resp.RequestHeaders
	if rh["X-Mine"] != "1" || rh["User-Agent"] != "primrose/0.1" {
		t.Errorf("explicit/UA: %v", rh)
	}
	if rh["Host"] == "" || rh["Content-Length"] != "7" || rh["Accept-Encoding"] != "gzip" {
		t.Errorf("implicit fields: %v", rh)
	}
	if rh["Content-Type"] != "application/json" {
		t.Errorf("content type: %v", rh)
	}
}
