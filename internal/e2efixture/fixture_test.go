// Package e2efixture writes the JSON the screenshot tests feed to the
// frontend's fake Wails bridge. It runs the real collection, env, resolve,
// http and tests packages over frontend/e2e/pet-store against a local
// server, so the screenshots show what the backend actually produces.
//
//	PRIMROSE_FIXTURE_OUT=$PWD/frontend/e2e/fixture.json go test ./internal/e2efixture
package e2efixture

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"primrose/internal/collection"
	"primrose/internal/env"
	"primrose/internal/httpclient"
	"primrose/internal/tests"
)

// what the screenshots show instead of this machine's checkout path and the
// test server's random port
const (
	fakeRoot = "/Users/ada/pet-store"
	fakeBase = "https://petstore.example.com"
)

type Fixture struct {
	Root         string                          `json:"root"`
	Collection   *collection.Collection          `json:"collection"`
	Requests     map[string]*collection.Request  `json:"requests"`
	Environments []env.Environment               `json:"environments"`
	Responses    map[string]*httpclient.Response `json:"responses"` // key: Key(method, url)
}

// Key identifies a response by method and URL template without the query,
// which is what the bridge can still recognize after the UI folded params in.
func Key(method, url string) string {
	base, _, _ := strings.Cut(url, "?")
	return strings.ToUpper(method) + " " + base
}

// a tiny pet store; Date and timing are left out so every run is identical
func petStore() http.Handler {
	mux := http.NewServeMux()
	jsonReply := func(w http.ResponseWriter, status int, body string) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Request-Id", "req-0001")
		w.WriteHeader(status)
		fmt.Fprint(w, body)
	}
	mux.HandleFunc("GET /pets", func(w http.ResponseWriter, r *http.Request) {
		jsonReply(w, 200, `{"pets":[{"id":7,"name":"Primrose","species":"cat","status":"available"},{"id":8,"name":"Biscuit","species":"dog","status":"available"},{"id":9,"name":"Pickle","species":"axolotl","status":"available"}],"page":{"limit":20,"next":null}}`)
	})
	mux.HandleFunc("GET /pets/{id}", func(w http.ResponseWriter, r *http.Request) {
		jsonReply(w, 200, `{"id":7,"name":"Primrose","species":"cat","tags":["fluffy","available"],"owner":{"name":"Ada","since":2019,"address":{"city":"Düsseldorf","zip":"40213"}},"vaccinated":true}`)
	})
	mux.HandleFunc("POST /pets", func(w http.ResponseWriter, r *http.Request) {
		jsonReply(w, 201, `{"id":10,"name":"Primrose","created":true}`)
	})
	mux.HandleFunc("PUT /orders/{id}", func(w http.ResponseWriter, r *http.Request) {
		jsonReply(w, 409, `{"error":"pet 7 is already reserved"}`)
	})
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		fmt.Fprint(w, "ok\n")
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header()["Date"] = nil // net/http adds one otherwise
		mux.ServeHTTP(w, r)
	})
}

func TestGenerate(t *testing.T) {
	out := os.Getenv("PRIMROSE_FIXTURE_OUT")
	if out == "" {
		t.Skip("set PRIMROSE_FIXTURE_OUT to regenerate frontend/e2e/fixture.json")
	}
	root, err := filepath.Abs("../../frontend/e2e/pet-store")
	if err != nil {
		t.Fatal(err)
	}
	col, err := collection.Open(root)
	if err != nil {
		t.Fatal(err)
	}
	envs, err := env.List(root)
	if err != nil {
		t.Fatal(err)
	}
	local := envs[0]
	for _, e := range envs {
		if e.Name == "local" {
			local = e
		}
	}

	srv := httptest.NewServer(petStore())
	defer srv.Close()
	vars := map[string]string{}
	for k, v := range local.Vars {
		vars[k] = v
	}
	vars["baseUrl"] = srv.URL

	fx := Fixture{Root: root, Collection: col, Environments: envs, Requests: map[string]*collection.Request{}, Responses: map[string]*httpclient.Response{}}
	var walk func([]*collection.Node)
	walk = func(nodes []*collection.Node) {
		for _, n := range nodes {
			if n.IsFolder {
				walk(n.Children)
				continue
			}
			r, err := collection.ReadRequest(n.Path)
			if err != nil {
				t.Fatal(err)
			}
			fx.Requests[n.Path] = r
			fx.Responses[Key(r.Method, r.URL)] = send(t, *r, vars, local.Headers)
		}
	}
	walk(col.Tree)

	data, err := json.MarshalIndent(fx, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	s := strings.ReplaceAll(string(data), root, fakeRoot)
	s = strings.ReplaceAll(s, srv.URL, fakeBase)
	s = strings.ReplaceAll(s, strings.TrimPrefix(srv.URL, "http://"), strings.TrimPrefix(fakeBase, "https://"))
	if err := os.WriteFile(out, []byte(s+"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
}

// what App.SendRequest does, minus cancellation and the cookie jar
func send(t *testing.T, r collection.Request, vars, inherited map[string]string) *httpclient.Response {
	r.Headers = collection.MergeHeaders(inherited, r.Headers)
	resolved := collection.Resolve(&r, vars, r.Vars)
	resp, err := httpclient.SendCtx(context.Background(), resolved, nil)
	if err != nil {
		t.Fatalf("%s %s: %v", r.Method, r.URL, err)
	}
	if resolved.Tests.Script != "" {
		resp.Tests = tests.Run(resolved.Tests.Script, tests.Input{
			Status: resp.Status, Headers: resp.Headers, Body: resp.Body,
			DurationMs: resp.DurationMs, Size: resp.Size, URL: resp.FinalURL,
		})
	}
	resp.DurationMs = 42 + int64(len(resp.Body)%50) // stable, and not all the same
	return resp
}
