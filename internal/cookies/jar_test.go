package cookies

import (
	"net/http"
	"net/url"
	"testing"
	"time"
)

func mustURL(t *testing.T, s string) *url.URL {
	t.Helper()
	u, err := url.Parse(s)
	if err != nil {
		t.Fatal(err)
	}
	return u
}

func setFromHeader(t *testing.T, j *Jar, rawURL, header string) {
	t.Helper()
	resp := http.Response{Header: http.Header{"Set-Cookie": {header}}}
	j.SetCookies(mustURL(t, rawURL), resp.Cookies())
}

func names(cs []*http.Cookie) []string {
	out := []string{}
	for _, c := range cs {
		out = append(out, c.Name)
	}
	return out
}

func TestHostOnlyVsDomainMatching(t *testing.T) {
	j := NewJar()
	setFromHeader(t, j, "https://api.x.io/", "hostonly=1")
	setFromHeader(t, j, "https://api.x.io/", "domainwide=1; Domain=x.io")

	if got := names(j.Cookies(mustURL(t, "https://api.x.io/"))); len(got) != 2 {
		t.Errorf("api.x.io should get both, got %v", got)
	}
	if got := names(j.Cookies(mustURL(t, "https://other.x.io/"))); len(got) != 1 || got[0] != "domainwide" {
		t.Errorf("other.x.io should get only the domain cookie, got %v", got)
	}
	if got := j.Cookies(mustURL(t, "https://x.io.evil.com/")); len(got) != 0 {
		t.Errorf("suffix trickery must not match, got %v", names(got))
	}
}

func TestPathAndSecureMatching(t *testing.T) {
	j := NewJar()
	setFromHeader(t, j, "https://x.io/", "sec=1; Secure; Path=/")
	setFromHeader(t, j, "https://x.io/", "scoped=1; Path=/api")

	if got := names(j.Cookies(mustURL(t, "http://x.io/"))); len(got) != 0 {
		t.Errorf("secure cookie over http: %v", got)
	}
	if got := names(j.Cookies(mustURL(t, "https://x.io/api/v1"))); len(got) != 2 {
		t.Errorf("/api/v1 should match both, got %v", got)
	}
	if got := names(j.Cookies(mustURL(t, "https://x.io/apix"))); len(got) != 1 || got[0] != "sec" {
		t.Errorf("/apix must not match /api, got %v", got)
	}
}

func TestExpiryAndOverwrite(t *testing.T) {
	j := NewJar()
	now := time.Now()
	j.now = func() time.Time { return now }

	setFromHeader(t, j, "https://x.io/", "s=1; Max-Age=60")
	setFromHeader(t, j, "https://x.io/", "s=2; Max-Age=60") // overwrite
	if list := j.List(); len(list) != 1 || list[0].Value != "2" {
		t.Fatalf("overwrite: %v", list)
	}

	setFromHeader(t, j, "https://x.io/", "s=; Max-Age=-1") // deletion via response
	if list := j.List(); len(list) != 0 {
		t.Fatalf("Max-Age<0 must delete, got %v", list)
	}

	setFromHeader(t, j, "https://x.io/", "t=1; Max-Age=60")
	now = now.Add(2 * time.Minute)
	if got := j.Cookies(mustURL(t, "https://x.io/")); len(got) != 0 {
		t.Errorf("expired cookie sent: %v", names(got))
	}
	if list := j.List(); len(list) != 0 {
		t.Errorf("expired cookie listed: %v", list)
	}
}

func TestManualAddDeleteClear(t *testing.T) {
	j := NewJar()
	j.Add(Cookie{Domain: "x.io", Name: "manual", Value: "1"})
	if got := names(j.Cookies(mustURL(t, "https://sub.x.io/"))); len(got) != 1 {
		t.Errorf("manual add should be domain-wide: %v", got)
	}
	j.Delete("x.io", "/", "manual")
	if len(j.List()) != 0 {
		t.Error("delete failed")
	}
	j.Add(Cookie{Domain: "x.io", Name: "a", Value: "1"})
	j.Add(Cookie{Domain: "x.io", Name: "b", Value: "2"})
	j.Clear()
	if len(j.List()) != 0 {
		t.Error("clear failed")
	}
}
