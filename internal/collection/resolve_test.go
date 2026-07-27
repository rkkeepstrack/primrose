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
	if v := got.Headers["X-Api-Key"]; v != "" {
		t.Errorf("missing env var should resolve to empty string, got %q", v)
	}
	if v, ok := got.Headers["X-Api-Key"]; !ok || v == "{{key}}" {
		t.Errorf("placeholder must be replaced, not kept: %q (present=%v)", v, ok)
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

func TestResolveMissingAndAdjacentDynamics(t *testing.T) {
	// missing dynamic vars resolve to empty string
	got := Resolve(&Request{URL: "/users/:gone/items"}, nil, map[string]string{})
	if got.URL != "/users//items" {
		t.Errorf("missing dynamic var: %q", got.URL)
	}
	// adjacent dynamics: the / delimiter of the second must not be consumed
	got = Resolve(&Request{URL: ":a/:b"}, nil, map[string]string{"a": "1", "b": "2"})
	if got.URL != "1/2" {
		t.Errorf("adjacent dynamics: %q", got.URL)
	}
	// env var names that are prefixes of one another
	got = Resolve(&Request{URL: "{{base}}{{base-url}}"}, map[string]string{"base": "A", "base-url": "B"}, nil)
	if got.URL != "AB" {
		t.Errorf("prefix names: %q", got.URL)
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
