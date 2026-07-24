package collection

import "testing"

func TestResolve(t *testing.T) {
	r := &Request{
		Method: "GET",
		URL:    "{{base}}/api/v1/{{tenant}}/teasers/:teaserId",
		Query:  map[string]string{"gallery": "{{galleryId}}", ":dynKey": "x"},
		Headers: map[string]string{
			"X-Api-Key":     "{{key}}",
			"Authorization": "Bearer abc:def", // colon inside a value: no delimiter, must survive
		},
		Body: Body{Type: "json", Content: `{"tenant": "{{tenant}}", "id": :teaserId}`},
	}
	got := Resolve(r,
		map[string]string{"base": "https://x.io", "tenant": "hb", "galleryId": "42"},
		map[string]string{"teaserId": "500", "dynKey": "resolvedKey"},
	)
	if got.URL != "https://x.io/api/v1/hb/teasers/500" {
		t.Errorf("url = %s", got.URL)
	}
	if got.Query["gallery"] != "42" {
		t.Errorf("query = %v", got.Query)
	}
	if got.Query["resolvedKey"] != "x" {
		t.Errorf("dynamic in query key: %v", got.Query)
	}
	if got.Headers["X-Api-Key"] != "{{key}}" {
		t.Errorf("missing var should stay visible, got %v", got.Headers)
	}
	if got.Headers["Authorization"] != "Bearer abc:def" {
		t.Errorf("colon in header value must not resolve: %q", got.Headers["Authorization"])
	}
	if got.Body.Content != `{"tenant": "hb", "id": 500}` {
		t.Errorf("body = %s", got.Body.Content)
	}
	if r.URL == got.URL {
		t.Error("original request must not be mutated")
	}
}

func TestResolveDynamicDelimiters(t *testing.T) {
	dyn := map[string]string{"id": "7", "pass": "nope"}
	cases := []struct{ in, want string }{
		{"https://x.io/users/:id", "https://x.io/users/7"}, // after /
		{"?g=:id", "?g=7"},   // after =
		{"&x=:id", "&x=7"},   // after &
		{":id", "7"},         // start of string
		{"a=1,:id", "a=1,7"}, // after comma
		{"https://user:pass@x.io", "https://user:pass@x.io"}, // basic auth untouched
		{"https://x.io:8080/p", "https://x.io:8080/p"},       // port untouched
		{"/users/:id-copy", "/users/7-copy"},                 // hyphen ends the name
	}
	for _, c := range cases {
		got := Resolve(&Request{URL: c.in}, nil, dyn)
		if got.URL != c.want {
			t.Errorf("Resolve(%q) = %q, want %q", c.in, got.URL, c.want)
		}
	}
}

func TestResolveKebabEnvNames(t *testing.T) {
	env := map[string]string{
		"api-url":       "https://x.io",
		"MY_TENANT":     "hb",
		"camelCase":     "c",
		"snake_case_v2": "s",
	}
	r := &Request{URL: "{{api-url}}/{{MY_TENANT}}/{{camelCase}}/{{snake_case_v2}}"}
	got := Resolve(r, env, nil)
	if got.URL != "https://x.io/hb/c/s" {
		t.Errorf("url = %s", got.URL)
	}
}
