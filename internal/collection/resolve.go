package collection

import (
	"regexp"
	"strings"
)

// Dynamic :vars are recognized only after a delimiter (start of string, /,
// =, &, ?, comma or whitespace) so that schemes (https://), basic auth
// (user:pass@) and colons inside header values never match. Names start
// with a letter, so ports (:8080) are out anyway. Env {{vars}} additionally
// allow hyphens (kebab-case); dynamic names deliberately don't, so a
// literal -suffix after a variable stays expressible.
// The same patterns exist in TS (frontend vars.ts) — they are the variable
// syntax contract between frontend and backend.
var (
	envVarRe     = regexp.MustCompile(`\{\{([A-Za-z_][A-Za-z0-9_-]*)\}\}`)
	dynamicVarRe = regexp.MustCompile(`(^|[/=&?,\s]):([A-Za-z_][A-Za-z0-9_]*)`)
)

// Resolve returns a copy of the request with {{env}} placeholders and
// :dynamic variables replaced in the URL, query keys and values, header
// keys and values, and the body. Placeholders without a value resolve to
// an empty string (the Variables tab flags them beforehand).
func Resolve(r *Request, envVars, dynamicVars map[string]string) *Request {
	sub := func(s string) string {
		s = envVarRe.ReplaceAllStringFunc(s, func(m string) string {
			name := m[2 : len(m)-2] // strip {{ }}
			return envVars[name]
		})
		return dynamicVarRe.ReplaceAllStringFunc(s, func(match string) string {
			// match = delimiter (possibly empty) + ":" + variable name
			delim, name, _ := strings.Cut(match, ":")
			return delim + dynamicVars[name]
		})
	}

	out := &Request{
		Method:  r.Method,
		URL:     sub(r.URL),
		Query:   make(map[string]string, len(r.Query)),
		Headers: make(map[string]string, len(r.Headers)),
		Body:    Body{Type: r.Body.Type, Content: sub(r.Body.Content)},
	}
	for k, v := range r.Query {
		out.Query[sub(k)] = sub(v)
	}
	for k, v := range r.Headers {
		out.Headers[sub(k)] = sub(v)
	}
	return out
}
