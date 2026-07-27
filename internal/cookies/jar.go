// Package cookies implements an enumerable, in-memory cookie jar
// (net/http/cookiejar cannot list its contents, which the cookie UI needs).
// Jars are per collection and session-only — never persisted.
package cookies

import (
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"
)

// Cookie is the UI-facing view of a stored cookie.
type Cookie struct {
	Domain   string `json:"domain"`
	Path     string `json:"path"`
	Name     string `json:"name"`
	Value    string `json:"value"`
	Expires  string `json:"expires"` // RFC 3339, empty = session cookie
	Secure   bool   `json:"secure"`
	HTTPOnly bool   `json:"httpOnly"`
	HostOnly bool   `json:"hostOnly"` // no Domain attribute: exact host match
}

type stored struct {
	Cookie
	expires time.Time // zero = session cookie
}

// Jar implements http.CookieJar with list/delete/clear/add on top.
type Jar struct {
	mu      sync.Mutex
	cookies []stored
	now     func() time.Time // injectable for tests
}

func NewJar() *Jar {
	return &Jar{now: time.Now}
}

// SetCookies implements http.CookieJar for response Set-Cookie headers.
func (j *Jar) SetCookies(u *url.URL, cs []*http.Cookie) {
	j.mu.Lock()
	defer j.mu.Unlock()
	host := strings.ToLower(u.Hostname())
	for _, c := range cs {
		s := stored{Cookie: Cookie{
			Name:     c.Name,
			Value:    c.Value,
			Path:     c.Path,
			Secure:   c.Secure,
			HTTPOnly: c.HttpOnly,
		}}
		if s.Path == "" {
			s.Path = defaultPath(u.Path)
		}
		if c.Domain != "" {
			s.Domain = strings.ToLower(strings.TrimPrefix(c.Domain, "."))
		} else {
			s.Domain = host
			s.HostOnly = true
		}
		expired := false
		switch {
		case c.MaxAge < 0:
			expired = true
		case c.MaxAge > 0:
			s.expires = j.now().Add(time.Duration(c.MaxAge) * time.Second)
		case !c.Expires.IsZero():
			s.expires = c.Expires
			expired = !c.Expires.After(j.now())
		}
		if !s.expires.IsZero() {
			s.Expires = s.expires.Format(time.RFC3339)
		}

		j.remove(s.Domain, s.Path, s.Name)
		if !expired {
			j.cookies = append(j.cookies, s)
		}
	}
}

// Cookies implements http.CookieJar for outgoing requests.
func (j *Jar) Cookies(u *url.URL) []*http.Cookie {
	j.mu.Lock()
	defer j.mu.Unlock()
	host := strings.ToLower(u.Hostname())
	path := u.Path
	if path == "" {
		path = "/"
	}
	https := u.Scheme == "https"

	var matched []stored
	kept := j.cookies[:0]
	for _, s := range j.cookies {
		if !s.expires.IsZero() && !s.expires.After(j.now()) {
			continue // expired: drop lazily
		}
		kept = append(kept, s)
		if s.Secure && !https {
			continue
		}
		if !domainMatch(host, s.Domain, s.HostOnly) || !pathMatch(path, s.Path) {
			continue
		}
		matched = append(matched, s)
	}
	j.cookies = kept

	// RFC 6265: longer paths first
	sort.Slice(matched, func(a, b int) bool {
		return len(matched[a].Path) > len(matched[b].Path)
	})
	out := make([]*http.Cookie, len(matched))
	for i, s := range matched {
		out[i] = &http.Cookie{Name: s.Name, Value: s.Value}
	}
	return out
}

// List returns all live cookies for the UI.
func (j *Jar) List() []Cookie {
	j.mu.Lock()
	defer j.mu.Unlock()
	out := []Cookie{}
	for _, s := range j.cookies {
		if !s.expires.IsZero() && !s.expires.After(j.now()) {
			continue
		}
		out = append(out, s.Cookie)
	}
	sort.Slice(out, func(a, b int) bool {
		if out[a].Domain != out[b].Domain {
			return out[a].Domain < out[b].Domain
		}
		return out[a].Name < out[b].Name
	})
	return out
}

// Add inserts a manually created cookie (domain required, path defaults /).
func (j *Jar) Add(c Cookie) {
	j.mu.Lock()
	defer j.mu.Unlock()
	c.Domain = strings.ToLower(strings.TrimPrefix(c.Domain, "."))
	if c.Path == "" {
		c.Path = "/"
	}
	s := stored{Cookie: c}
	if c.Expires != "" {
		if t, err := time.Parse(time.RFC3339, c.Expires); err == nil {
			s.expires = t
		}
	}
	j.remove(c.Domain, c.Path, c.Name)
	j.cookies = append(j.cookies, s)
}

// Delete removes one cookie by identity.
func (j *Jar) Delete(domain, path, name string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.remove(domain, path, name)
}

// Clear empties the jar.
func (j *Jar) Clear() {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.cookies = nil
}

func (j *Jar) remove(domain, path, name string) {
	kept := j.cookies[:0]
	for _, s := range j.cookies {
		if s.Domain == domain && s.Path == path && s.Name == name {
			continue
		}
		kept = append(kept, s)
	}
	j.cookies = kept
}

// domainMatch: host-only cookies need the exact host; domain cookies match
// the domain itself and any subdomain.
func domainMatch(host, domain string, hostOnly bool) bool {
	if hostOnly {
		return host == domain
	}
	return host == domain || strings.HasSuffix(host, "."+domain)
}

// pathMatch per RFC 6265 §5.1.4 (simplified).
func pathMatch(reqPath, cookiePath string) bool {
	if reqPath == cookiePath {
		return true
	}
	if strings.HasPrefix(reqPath, cookiePath) {
		return strings.HasSuffix(cookiePath, "/") || reqPath[len(cookiePath)] == '/'
	}
	return false
}

// defaultPath per RFC 6265 §5.1.4.
func defaultPath(reqPath string) string {
	i := strings.LastIndex(reqPath, "/")
	if i <= 0 {
		return "/"
	}
	return reqPath[:i]
}
