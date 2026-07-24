package collection

import "testing"

func TestResolve(t *testing.T) {
	r := &Request{
		Method:  "GET",
		URL:     "{{base}}/api/v1/{{tenant}}/teasers/:teaserId",
		Query:   map[string]string{"gallery": "{{galleryId}}"},
		Headers: map[string]string{"X-Api-Key": "{{key}}"},
		Body:    Body{Type: "json", Content: `{"tenant": "{{tenant}}"}`},
	}
	got := Resolve(r,
		map[string]string{"base": "https://x.io", "tenant": "hb", "galleryId": "42"},
		map[string]string{"teaserId": "500"},
	)
	if got.URL != "https://x.io/api/v1/hb/teasers/500" {
		t.Errorf("url = %s", got.URL)
	}
	if got.Query["gallery"] != "42" {
		t.Errorf("query = %v", got.Query)
	}
	if got.Headers["X-Api-Key"] != "{{key}}" {
		t.Errorf("missing var should stay visible, got %v", got.Headers)
	}
	if got.Body.Content != `{"tenant": "hb"}` {
		t.Errorf("body = %s", got.Body.Content)
	}
	if r.URL == got.URL {
		t.Error("original request must not be mutated")
	}
}
