// Package tomlutil provides TOML string/key encoding shared by the
// hand-written serializers in collection and env.
package tomlutil

import (
	"fmt"
	"strings"
)

// IsBareKey reports whether k can be written unquoted in TOML.
func IsBareKey(k string) bool {
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

// Key renders a TOML key, quoting it only when necessary.
func Key(k string) string {
	if IsBareKey(k) {
		return k
	}
	return String(k)
}

// String renders a TOML basic string with valid TOML escapes.
// (strconv.Quote is close but emits Go-only escapes like \x1b, which
// TOML parsers reject.)
func String(s string) string {
	var b strings.Builder
	b.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"':
			b.WriteString(`\"`)
		case '\\':
			b.WriteString(`\\`)
		case '\b':
			b.WriteString(`\b`)
		case '\t':
			b.WriteString(`\t`)
		case '\n':
			b.WriteString(`\n`)
		case '\f':
			b.WriteString(`\f`)
		case '\r':
			b.WriteString(`\r`)
		default:
			if r < 0x20 || r == 0x7f {
				fmt.Fprintf(&b, `\u%04X`, r)
			} else {
				b.WriteRune(r)
			}
		}
	}
	b.WriteByte('"')
	return b.String()
}
