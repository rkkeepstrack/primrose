package collection

import (
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
)

// WriteRequest serializes a request to TOML by hand so the output stays
// stable and human-friendly: fixed section order, body content in a
// multi-line '''...''' string.
func WriteRequest(path string, r *Request) error {
	var b strings.Builder

	fmt.Fprintf(&b, "method = %s\n", tomlString(strings.ToUpper(r.Method)))
	fmt.Fprintf(&b, "url = %s\n", tomlString(r.URL))

	writeSection := func(name string, m map[string]string) {
		if len(m) == 0 {
			return
		}
		b.WriteString("\n[" + name + "]\n")
		keys := make([]string, 0, len(m))
		for k := range m {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			fmt.Fprintf(&b, "%s = %s\n", tomlKey(k), tomlString(m[k]))
		}
	}
	writeSection("query", r.Query)
	writeSection("headers", r.Headers)

	if r.Body.Content != "" {
		b.WriteString("\n[body]\n")
		fmt.Fprintf(&b, "type = %s\n", tomlString(r.Body.Type))
		if strings.Contains(r.Body.Content, "'''") {
			fmt.Fprintf(&b, "content = %s\n", tomlString(r.Body.Content))
		} else {
			content := strings.TrimSuffix(r.Body.Content, "\n")
			fmt.Fprintf(&b, "content = '''\n%s\n'''\n", content)
		}
	}

	return os.WriteFile(path, []byte(b.String()), 0o644)
}

// tomlString renders a TOML basic string. Go's strconv.Quote escapes are a
// compatible subset of TOML's for the characters we emit.
func tomlString(s string) string {
	return strconv.Quote(s)
}

var bareKey = func(k string) bool {
	if k == "" {
		return false
	}
	for _, c := range k {
		ok := c == '-' || c == '_' ||
			(c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
		if !ok {
			return false
		}
	}
	return true
}

func tomlKey(k string) string {
	if bareKey(k) {
		return k
	}
	return tomlString(k)
}
