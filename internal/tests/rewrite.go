// Package tests runs a request's Starlark assertion script against a
// response and reports one pass/fail entry per assert statement.
package tests

import (
	"fmt"
	"strconv"
	"strings"
)

// instrument rewrites every `assert EXPR[, MSG]` line into a call to the
// predeclared _check builtin. Starlark has no assert statement, so this
// text rewrite is both what makes `assert` legal syntax and what turns each
// assert into its own recorded result: _check records pass/fail instead of
// aborting, so one failed assertion never stops the rest. Line numbers and
// indentation are preserved (one line stays one line), so Starlark error
// positions map straight back to the user's script. Multi-line assert
// expressions are not supported — the rewrite is line-based.
func instrument(script string) string {
	lines := strings.Split(script, "\n")
	for i, line := range lines {
		trimmed := strings.TrimLeft(line, " \t")
		if !strings.HasPrefix(trimmed, "assert ") {
			continue
		}
		indent := line[:len(line)-len(trimmed)]
		src := strings.TrimSpace(stripComment(trimmed))
		rest := strings.TrimSpace(strings.TrimPrefix(src, "assert "))
		if rest == "" {
			continue // bare "assert" — leave it; Starlark reports the syntax error
		}
		// [EXPR] or [EXPR, MSG]: the bracket wrapping keeps the rewrite a
		// single expression without having to parse the comma ourselves
		lines[i] = fmt.Sprintf("%s_check(%d, %s, [%s])", indent, i+1, strconv.Quote(src), rest)
	}
	return strings.Join(lines, "\n")
}

// stripComment removes a trailing # comment, respecting string literals so
// a "#" inside quotes survives.
func stripComment(s string) string {
	var quote byte
	for i := 0; i < len(s); i++ {
		c := s[i]
		if quote != 0 {
			if c == '\\' {
				i++
				continue
			}
			if c == quote {
				quote = 0
			}
			continue
		}
		switch c {
		case '\'', '"':
			quote = c
		case '#':
			return strings.TrimRight(s[:i], " \t")
		}
	}
	return s
}
