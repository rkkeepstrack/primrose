package collection

import (
	"regexp"
	"strings"
)

var dynamicVarRe = regexp.MustCompile(`/:([A-Za-z_][A-Za-z0-9_]*)`)

// Resolve returns a copy of the request with {{env}} placeholders replaced
// everywhere and /:dynamic path variables replaced in the URL. Placeholders
// without a value are left untouched so the failure is visible.
func Resolve(r *Request, envVars, dynamicVars map[string]string) *Request {
	sub := func(s string) string {
		for k, v := range envVars {
			s = strings.ReplaceAll(s, "{{"+k+"}}", v)
		}
		return s
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

	out.URL = dynamicVarRe.ReplaceAllStringFunc(out.URL, func(m string) string {
		name := m[2:] // strip "/:"
		if v, ok := dynamicVars[name]; ok && v != "" {
			return "/" + v
		}
		return m
	})
	return out
}
