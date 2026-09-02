# Test Assertions (Starlark) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bruno-style post-response assertions written in Starlark, run sandboxed in the Go backend, with per-assert pass/fail results shown in a "Tests" response tab and edited in a "Tests" request tab.

**Architecture:** A new Go package `internal/tests/` textually instruments top-level `assert` lines into calls to a recording builtin, executes the script with `go.starlark.net` against a predeclared `res` struct built from the HTTP response, and returns `{line, source, ok, message}` results plus counts. `app.go` runs the script after `SendRequest` (script text goes through the same `collection.Resolve` interpolation as bodies) and attaches the report to `httpclient.Response`. The frontend adds a Python-highlighted `CodeEditor` tab on the request side and a badge + results-list tab on the response side.

**Tech Stack:** Go 1.25, `go.starlark.net`, `github.com/BurntSushi/toml`; Svelte 5 + TypeScript + Vite, CodeMirror 6, `@codemirror/legacy-modes` (python), Vitest (jsdom for DOM tests).

**Spec:** `docs/superpowers/specs/2026-09-02-sticky-tests-secrets-history-design.md` (section 2 only).

## Global Constraints

- Implement ONLY spec §2 ("Test assertions (Starlark)") and its testing notes. No pre-request scripts, no JS, no network/fs access from scripts.
- Script storage in request TOML: a `[tests]` table with a `script` string (multi-line `'''…'''` when possible).
- `res` object fields exactly: `res.status` (int), `res.headers` (dict, lowercase keys, comma-joined multi-values), `res.body` (parsed JSON as dict/list/scalar; raw string when not JSON), `res.duration_ms` (int), `res.size` (int), `res.url` (final URL string).
- Each top-level `assert` is one pass/fail entry; one failure must not stop the rest. An `assert` inside a loop/conditional is a single entry — first failing iteration fails it. Runtime errors become a failed entry carrying the error text.
- Results shape: list of `{line, source, ok, message}` plus summary counts, attached to the `SendRequest` response.
- `{{env_var}}` interpolation is applied to the script text before execution via `collection.Resolve` (same pipeline as bodies).
- Go tests: `go test ./...` from `/Users/rakali/_pprojects/primrose`. Frontend tests: `cd /Users/rakali/_pprojects/primrose/frontend && npm test`.
- Match existing style: tab-indented Go with doc comments explaining "why"; Svelte components with scoped styles using existing CSS variables (`--green-bg`, `--green-text`, `--red-bg`, `--red-text`, `--mono`, `--text-soft`, `--border-faint`, …).

---

### Task 1: Starlark dependency + assert instrumentation (`internal/tests/rewrite.go`)

**Files:**
- Modify: `/Users/rakali/_pprojects/primrose/go.mod` (via `go get`)
- Create: `/Users/rakali/_pprojects/primrose/internal/tests/rewrite.go`
- Test: `/Users/rakali/_pprojects/primrose/internal/tests/rewrite_test.go`

**Interfaces:**
- Consumes: nothing (leaf package, stdlib only in this task).
- Produces: `func instrument(script string) string` (package-private) — rewrites every line whose statement starts with `assert ` into `_check(<1-based line>, <quoted source>, [<expr[, msg]>])`, preserving indentation and line count. Also `func stripComment(s string) string`. Task 2 calls `instrument`.

- [ ] **Step 1: Add the go.starlark.net dependency**

```bash
cd /Users/rakali/_pprojects/primrose && go get go.starlark.net@latest && go mod tidy
```

Expected: `go.mod` gains a `go.starlark.net` require line (plus `golang.org/x/...` indirects as needed).

- [ ] **Step 2: Write the failing test**

Create `/Users/rakali/_pprojects/primrose/internal/tests/rewrite_test.go`:

```go
package tests

import "testing"

func TestInstrument(t *testing.T) {
	cases := []struct {
		name, in, want string
	}{
		{
			name: "plain assert",
			in:   `assert res.status == 200`,
			want: `_check(1, "assert res.status == 200", [res.status == 200])`,
		},
		{
			name: "assert with message",
			in:   `assert item["id"], "every item needs an id"`,
			want: `_check(1, "assert item[\"id\"], \"every item needs an id\"", [item["id"], "every item needs an id"])`,
		},
		{
			name: "indented assert keeps indentation and line number",
			in:   "for x in res.body:\n    assert x > 0",
			want: "for x in res.body:\n    _check(2, \"assert x > 0\", [x > 0])",
		},
		{
			name: "trailing comment is stripped",
			in:   `assert res.status == 200  # must be ok`,
			want: `_check(1, "assert res.status == 200", [res.status == 200])`,
		},
		{
			name: "hash inside string survives",
			in:   `assert res.body["tag"] == "#1"`,
			want: `_check(1, "assert res.body[\"tag\"] == \"#1\"", [res.body["tag"] == "#1"])`,
		},
		{
			name: "non-assert lines untouched",
			in:   "x = 1\nassert x\ny = 2",
			want: "x = 1\n_check(2, \"assert x\", [x])\ny = 2",
		},
		{
			name: "bare assert left alone (becomes a syntax error later)",
			in:   `assert`,
			want: `assert`,
		},
		{
			name: "asserting a variable named assertion is not an assert",
			in:   `assertion = 1`,
			want: `assertion = 1`,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := instrument(c.in); got != c.want {
				t.Errorf("instrument(%q)\n got:  %s\n want: %s", c.in, got, c.want)
			}
		})
	}
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd /Users/rakali/_pprojects/primrose && go test ./internal/tests/`
Expected: FAIL to compile with "undefined: instrument".

- [ ] **Step 4: Write the implementation**

Create `/Users/rakali/_pprojects/primrose/internal/tests/rewrite.go`:

```go
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd /Users/rakali/_pprojects/primrose && go test ./internal/tests/`
Expected: PASS (all 8 subtests).

- [ ] **Step 6: Commit**

```bash
cd /Users/rakali/_pprojects/primrose && git add go.mod go.sum internal/tests/ && git commit -m "feat(tests): add starlark dep and assert instrumentation"
```

---

### Task 2: Starlark runner with `res` object (`internal/tests/run.go`)

**Files:**
- Create: `/Users/rakali/_pprojects/primrose/internal/tests/run.go`
- Test: `/Users/rakali/_pprojects/primrose/internal/tests/run_test.go`

**Interfaces:**
- Consumes: `instrument(script string) string` from Task 1.
- Produces (exported, used by Tasks 3):

```go
type Result struct {
	Line    int    `json:"line"`
	Source  string `json:"source"`
	Ok      bool   `json:"ok"`
	Message string `json:"message"`
}

type Report struct {
	Results []Result `json:"results"`
	Passed  int      `json:"passed"`
	Total   int      `json:"total"`
}

type Input struct {
	Status     int
	Headers    map[string]string // as received; Run lowercases the keys
	Body       string
	DurationMs int64
	Size       int64
	URL        string
}

func Run(script string, in Input) *Report
```

- [ ] **Step 1: Write the failing tests**

Create `/Users/rakali/_pprojects/primrose/internal/tests/run_test.go`:

```go
package tests

import (
	"strings"
	"testing"
)

func input() Input {
	return Input{
		Status:     200,
		Headers:    map[string]string{"Content-Type": "application/json; charset=utf-8", "X-Multi": "a, b"},
		Body:       `{"ok": true, "count": 3, "data": [{"id": 1}, {"id": 2}], "pi": 3.5, "name": "primrose"}`,
		DurationMs: 42,
		Size:       88,
		URL:        "https://api.example/final",
	}
}

func TestRunAllPass(t *testing.T) {
	rep := Run(strings.Join([]string{
		`assert res.status == 200`,
		`assert "json" in res.headers["content-type"]`,
		`assert res.body["count"] == 3`,
		`assert res.body["pi"] > 3`,
		`assert res.duration_ms == 42`,
		`assert res.size == 88`,
		`assert res.url == "https://api.example/final"`,
	}, "\n"), input())
	if rep.Passed != 7 || rep.Total != 7 {
		t.Fatalf("passed/total = %d/%d, want 7/7; results: %+v", rep.Passed, rep.Total, rep.Results)
	}
	if rep.Results[0].Line != 1 || rep.Results[0].Source != "assert res.status == 200" || !rep.Results[0].Ok {
		t.Errorf("first result = %+v", rep.Results[0])
	}
}

func TestRunFailureDoesNotStopTheRest(t *testing.T) {
	rep := Run("assert res.status == 500, \"wanted an error\"\nassert res.body[\"ok\"]", input())
	if rep.Total != 2 || rep.Passed != 1 {
		t.Fatalf("passed/total = %d/%d, want 1/2", rep.Passed, rep.Total)
	}
	if rep.Results[0].Ok || rep.Results[0].Message != "wanted an error" {
		t.Errorf("failed entry = %+v", rep.Results[0])
	}
	if !rep.Results[1].Ok {
		t.Errorf("second assert should still run and pass: %+v", rep.Results[1])
	}
}

func TestRunFailureWithoutMessage(t *testing.T) {
	rep := Run(`assert res.status == 500`, input())
	if rep.Results[0].Ok || rep.Results[0].Message != "assertion failed" {
		t.Errorf("entry = %+v", rep.Results[0])
	}
}

func TestRunLoopIsSingleEntry(t *testing.T) {
	script := "for item in res.body[\"data\"]:\n    assert item[\"id\"] < 2, \"id \" + str(item[\"id\"]) + \" too big\""
	rep := Run(script, input())
	if rep.Total != 1 {
		t.Fatalf("loop assert must be one entry, got %d: %+v", rep.Total, rep.Results)
	}
	r := rep.Results[0]
	if r.Ok || r.Line != 2 || r.Message != "id 2 too big" {
		t.Errorf("entry = %+v (want fail on first failing iteration with its message)", r)
	}
}

func TestRunLoopAllIterationsPass(t *testing.T) {
	script := "for item in res.body[\"data\"]:\n    assert item[\"id\"] >= 1"
	rep := Run(script, input())
	if rep.Total != 1 || rep.Passed != 1 {
		t.Fatalf("passed/total = %d/%d, want 1/1", rep.Passed, rep.Total)
	}
}

func TestRunRuntimeErrorBecomesFailedEntry(t *testing.T) {
	rep := Run("assert res.status == 200\nassert res.body[\"missing\"] == 1", input())
	if rep.Total != 2 || rep.Passed != 1 {
		t.Fatalf("passed/total = %d/%d, want 1/2; results: %+v", rep.Passed, rep.Total, rep.Results)
	}
	last := rep.Results[len(rep.Results)-1]
	if last.Ok || last.Line != 2 || last.Message == "" {
		t.Errorf("runtime error entry = %+v (want ok=false, line=2, error text)", last)
	}
}

func TestRunSyntaxErrorBecomesFailedEntry(t *testing.T) {
	rep := Run("this is not starlark ((", input())
	if rep.Total != 1 || rep.Passed != 0 || rep.Results[0].Ok {
		t.Fatalf("syntax error must yield one failed entry, got %+v", rep)
	}
}

func TestRunNonJSONBodyIsRawString(t *testing.T) {
	in := input()
	in.Body = "<html>hi</html>"
	rep := Run(`assert "html" in res.body`, in)
	if rep.Passed != 1 {
		t.Errorf("raw body assert failed: %+v", rep.Results)
	}
}

func TestRunHeadersAreLowercase(t *testing.T) {
	rep := Run(`assert res.headers["x-multi"] == "a, b"`, input())
	if rep.Passed != 1 {
		t.Errorf("lowercase header lookup failed: %+v", rep.Results)
	}
}

func TestRunEmptyScriptEmptyReport(t *testing.T) {
	rep := Run("", input())
	if rep.Total != 0 || rep.Passed != 0 || len(rep.Results) != 0 {
		t.Errorf("empty script must produce an empty report, got %+v", rep)
	}
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/rakali/_pprojects/primrose && go test ./internal/tests/`
Expected: FAIL to compile with "undefined: Run" (and Input/Report).

- [ ] **Step 3: Write the implementation**

Create `/Users/rakali/_pprojects/primrose/internal/tests/run.go`:

```go
package tests

import (
	"encoding/json"
	"strings"

	"go.starlark.net/starlark"
	"go.starlark.net/starlarkstruct"
	"go.starlark.net/syntax"
)

// Result is one assert statement's outcome.
type Result struct {
	Line    int    `json:"line"`
	Source  string `json:"source"`
	Ok      bool   `json:"ok"`
	Message string `json:"message"`
}

// Report is what the frontend renders in the response's Tests tab.
type Report struct {
	Results []Result `json:"results"`
	Passed  int      `json:"passed"`
	Total   int      `json:"total"`
}

// Input carries the response fields the script can see; it deliberately
// avoids importing httpclient so httpclient can import this package.
type Input struct {
	Status     int
	Headers    map[string]string
	Body       string
	DurationMs int64
	Size       int64
	URL        string
}

// fileOpts loosens Starlark's default file grammar: test scripts naturally
// use top-level for/if, which core Starlark reserves for REPLs.
var fileOpts = &syntax.FileOptions{
	Set:             true,
	While:           true,
	TopLevelControl: true,
	GlobalReassign:  true,
	Recursion:       true,
}

// Run executes the (already env-resolved) script sandboxed — Starlark
// scripts get no filesystem, network, or module access — and reports one
// entry per assert statement. An assert inside a loop is a single entry:
// the first failing iteration fails it. A runtime or syntax error appends
// a failed entry with the error text; asserts recorded before it are kept.
func Run(script string, in Input) *Report {
	byLine := map[int]*Result{}
	var results []*Result

	check := starlark.NewBuiltin("_check", func(_ *starlark.Thread, _ *starlark.Builtin, args starlark.Tuple, kwargs []starlark.Tuple) (starlark.Value, error) {
		var line int
		var source string
		var parts *starlark.List
		if err := starlark.UnpackPositionalArgs("_check", args, kwargs, 3, &line, &source, &parts); err != nil {
			return nil, err
		}
		r := byLine[line]
		if r == nil {
			r = &Result{Line: line, Source: source, Ok: true}
			byLine[line] = r
			results = append(results, r)
		}
		// only the first failing call marks the entry, so a loop reports
		// the earliest failing iteration's message
		if r.Ok && !bool(parts.Index(0).Truth()) {
			r.Ok = false
			r.Message = "assertion failed"
			if parts.Len() > 1 {
				r.Message = plain(parts.Index(1))
			}
		}
		return starlark.None, nil
	})

	predeclared := starlark.StringDict{"res": resValue(in), "_check": check}
	thread := &starlark.Thread{Name: "tests"}
	_, err := starlark.ExecFileOptions(fileOpts, thread, "tests", instrument(script), predeclared)
	if err != nil {
		line, msg := 0, err.Error()
		if ee, ok := err.(*starlark.EvalError); ok {
			msg = ee.Msg
			if n := len(ee.CallStack); n > 0 {
				line = int(ee.CallStack.At(n - 1).Pos.Line)
			}
		}
		results = append(results, &Result{Line: line, Source: sourceLine(script, line), Ok: false, Message: msg})
	}

	rep := &Report{Results: make([]Result, 0, len(results))}
	for _, r := range results {
		rep.Results = append(rep.Results, *r)
		if r.Ok {
			rep.Passed++
		}
	}
	rep.Total = len(rep.Results)
	return rep
}

// resValue builds the predeclared res struct: status, headers (lowercase
// keys), body (parsed JSON, or the raw string when it isn't JSON),
// duration_ms, size, url.
func resValue(in Input) starlark.Value {
	headers := starlark.NewDict(len(in.Headers))
	for k, v := range in.Headers {
		_ = headers.SetKey(starlark.String(strings.ToLower(k)), starlark.String(v))
	}
	var body starlark.Value = starlark.String(in.Body)
	dec := json.NewDecoder(strings.NewReader(in.Body))
	dec.UseNumber() // keep integers exact so res.body["count"] == 3 holds
	var parsed any
	if err := dec.Decode(&parsed); err == nil && !dec.More() {
		body = toStarlark(parsed)
	}
	return starlarkstruct.FromStringDict(starlark.String("res"), starlark.StringDict{
		"status":      starlark.MakeInt(in.Status),
		"headers":     headers,
		"body":        body,
		"duration_ms": starlark.MakeInt64(in.DurationMs),
		"size":        starlark.MakeInt64(in.Size),
		"url":         starlark.String(in.URL),
	})
}

// toStarlark converts a decoded JSON value into Starlark dicts/lists/scalars.
func toStarlark(v any) starlark.Value {
	switch x := v.(type) {
	case nil:
		return starlark.None
	case bool:
		return starlark.Bool(x)
	case json.Number:
		if i, err := x.Int64(); err == nil {
			return starlark.MakeInt64(i)
		}
		f, _ := x.Float64()
		return starlark.Float(f)
	case string:
		return starlark.String(x)
	case []any:
		elems := make([]starlark.Value, len(x))
		for i, e := range x {
			elems[i] = toStarlark(e)
		}
		return starlark.NewList(elems)
	case map[string]any:
		d := starlark.NewDict(len(x))
		for k, e := range x {
			_ = d.SetKey(starlark.String(k), toStarlark(e))
		}
		return d
	}
	return starlark.None
}

// plain renders an assert message: strings unquoted, everything else via
// Starlark's repr.
func plain(v starlark.Value) string {
	if s, ok := starlark.AsString(v); ok {
		return s
	}
	return v.String()
}

// sourceLine returns the trimmed original script line for error entries.
func sourceLine(script string, line int) string {
	lines := strings.Split(script, "\n")
	if line < 1 || line > len(lines) {
		return ""
	}
	return strings.TrimSpace(lines[line-1])
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/rakali/_pprojects/primrose && go test ./internal/tests/ -v`
Expected: PASS (all TestRun* and TestInstrument).

Note: if `starlark.ExecFileOptions` is not found, the installed go.starlark.net version predates it — use `starlark.ExecFile(thread, "tests", instrument(script), predeclared)` and set the options via `resolve` package globals instead; but with `@latest` (2024+) `ExecFileOptions` exists.

- [ ] **Step 5: Run the full Go suite**

Run: `cd /Users/rakali/_pprojects/primrose && go test ./...`
Expected: PASS everywhere (nothing else touched yet).

- [ ] **Step 6: Commit**

```bash
cd /Users/rakali/_pprojects/primrose && git add internal/tests/ && git commit -m "feat(tests): starlark runner with per-assert reporting and res object"
```

---

### Task 3: Backend wiring — TOML `[tests]`, Resolve, Response field, SendRequest

**Files:**
- Modify: `/Users/rakali/_pprojects/primrose/internal/collection/collection.go` (Request struct, ReadRequest)
- Modify: `/Users/rakali/_pprojects/primrose/internal/collection/write.go` (WriteRequest)
- Modify: `/Users/rakali/_pprojects/primrose/internal/collection/resolve.go` (Resolve)
- Modify: `/Users/rakali/_pprojects/primrose/internal/httpclient/httpclient.go` (Response struct)
- Modify: `/Users/rakali/_pprojects/primrose/app.go` (SendRequest)
- Test: `/Users/rakali/_pprojects/primrose/internal/collection/tests_section_test.go` (new)

**Interfaces:**
- Consumes: `tests.Run(script string, in tests.Input) *tests.Report` from Task 2.
- Produces:
  - `collection.Tests` struct `{ Script string }` with tags `toml:"script" json:"script"`; `collection.Request.Tests Tests` with tags `toml:"tests" json:"tests"`.
  - `httpclient.Response.Tests *tests.Report` with tag `json:"tests,omitempty"` — the frontend (Tasks 4–6) reads it as `response.tests`.

- [ ] **Step 1: Write the failing tests**

Create `/Users/rakali/_pprojects/primrose/internal/collection/tests_section_test.go`:

```go
package collection

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestTestsScriptRoundTrip(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "req.toml")
	script := "assert res.status == 200\nfor item in res.body[\"data\"]:\n    assert item[\"id\"]"
	r := &Request{Method: "GET", URL: "https://x.io", Tests: Tests{Script: script}}
	if err := WriteRequest(path, r); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), "[tests]") || !strings.Contains(string(raw), "script = '''") {
		t.Errorf("expected a [tests] table with a multi-line script, got:\n%s", raw)
	}
	got, err := ReadRequest(path)
	if err != nil {
		t.Fatal(err)
	}
	if got.Tests.Script != script {
		t.Errorf("script round-trip:\n got:  %q\n want: %q", got.Tests.Script, script)
	}
}

func TestTestsScriptOmittedWhenEmpty(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "req.toml")
	if err := WriteRequest(path, &Request{Method: "GET", URL: "https://x.io"}); err != nil {
		t.Fatal(err)
	}
	raw, _ := os.ReadFile(path)
	if strings.Contains(string(raw), "[tests]") {
		t.Errorf("empty script must not write a [tests] table:\n%s", raw)
	}
}

func TestResolveInterpolatesTestScript(t *testing.T) {
	r := &Request{
		Method: "GET",
		URL:    "https://x.io",
		Tests:  Tests{Script: `assert res.body["env"] == "{{stage}}"`},
	}
	got := Resolve(r, map[string]string{"stage": "prod"}, nil)
	if got.Tests.Script != `assert res.body["env"] == "prod"` {
		t.Errorf("script = %q", got.Tests.Script)
	}
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/rakali/_pprojects/primrose && go test ./internal/collection/`
Expected: FAIL to compile with "undefined: Tests" / "unknown field Tests".

- [ ] **Step 3: Add the Tests struct and Request field**

In `/Users/rakali/_pprojects/primrose/internal/collection/collection.go`, after the `Body` struct (around line 26), add:

```go
// Tests holds the request's post-response Starlark assertion script.
type Tests struct {
	Script string `toml:"script" json:"script"`
}
```

In the `Request` struct, after the `Vars` field, add:

```go
	// post-response assertions, run sandboxed after a send
	Tests Tests `toml:"tests" json:"tests"`
```

(No ReadRequest default needed: TOML decoding leaves the zero value `Tests{}` when the table is absent, which serializes as `{"script":""}` — exactly what the frontend expects.)

- [ ] **Step 4: Write the [tests] table in WriteRequest**

In `/Users/rakali/_pprojects/primrose/internal/collection/write.go`, at the end of `WriteRequest` after the `[body]` block (before `return os.WriteFile(...)`), add:

```go
	if r.Tests.Script != "" {
		b.WriteString("\n[tests]\n")
		if strings.Contains(r.Tests.Script, "'''") {
			fmt.Fprintf(&b, "script = %s\n", tomlutil.String(r.Tests.Script))
		} else {
			script := strings.TrimSuffix(r.Tests.Script, "\n")
			fmt.Fprintf(&b, "script = '''\n%s\n'''\n", script)
		}
	}
```

- [ ] **Step 5: Interpolate the script in Resolve**

In `/Users/rakali/_pprojects/primrose/internal/collection/resolve.go`, in the `out := &Request{...}` literal, add after the `Body:` line:

```go
		Tests:   Tests{Script: sub(r.Tests.Script)},
```

- [ ] **Step 6: Run the collection tests**

Run: `cd /Users/rakali/_pprojects/primrose && go test ./internal/collection/`
Expected: PASS (new tests plus all pre-existing ones).

- [ ] **Step 7: Attach the report to the response**

In `/Users/rakali/_pprojects/primrose/internal/httpclient/httpclient.go`, add to the imports:

```go
	"primrose/internal/tests"
```

and add to the `Response` struct after the `Size` field:

```go
	// Tests carries the request's assertion results; nil when the request
	// has no test script.
	Tests *tests.Report `json:"tests,omitempty"`
```

In `/Users/rakali/_pprojects/primrose/app.go`, add `"primrose/internal/tests"` to the imports and change the end of `SendRequest` from:

```go
	resolved := collection.Resolve(&r, envVars, dynamicVars)
	resp, err := httpclient.SendCtx(ctx, resolved, a.jarFor(root))
	if ctx.Err() == context.Canceled {
		return nil, fmt.Errorf("canceled")
	}
	return resp, err
```

to:

```go
	resolved := collection.Resolve(&r, envVars, dynamicVars)
	resp, err := httpclient.SendCtx(ctx, resolved, a.jarFor(root))
	if ctx.Err() == context.Canceled {
		return nil, fmt.Errorf("canceled")
	}
	// assertions run after a successful exchange; the script text was
	// already {{env}}-resolved by collection.Resolve, same as the body
	if err == nil && resp != nil && resolved.Tests.Script != "" {
		resp.Tests = tests.Run(resolved.Tests.Script, tests.Input{
			Status:     resp.Status,
			Headers:    resp.Headers,
			Body:       resp.Body,
			DurationMs: resp.DurationMs,
			Size:       resp.Size,
			URL:        resp.FinalURL,
		})
	}
	return resp, err
```

- [ ] **Step 8: Run the full Go suite and build**

Run: `cd /Users/rakali/_pprojects/primrose && go build ./... && go test ./...`
Expected: builds clean, all tests PASS.

- [ ] **Step 9: Commit**

```bash
cd /Users/rakali/_pprojects/primrose && git add internal/collection/ internal/httpclient/httpclient.go app.go && git commit -m "feat(tests): [tests] script in request TOML, resolved and run on send"
```

---

### Task 4: Frontend types, script setter, and store defaults

**Files:**
- Modify: `/Users/rakali/_pprojects/primrose/frontend/src/lib/shared/types.ts`
- Modify: `/Users/rakali/_pprojects/primrose/frontend/src/lib/request/requestEdit.ts`
- Modify: `/Users/rakali/_pprojects/primrose/frontend/src/lib/workspace/requests.ts`
- Test: `/Users/rakali/_pprojects/primrose/frontend/src/tests/request/testScript.test.ts` (new)

**Interfaces:**
- Consumes: existing `edit()` helper in `requestEdit.ts`, `request`/`dirty` stores in `workspace/state.ts`.
- Produces:
  - `interface TestResult { line: number; source: string; ok: boolean; message: string }`
  - `interface TestReport { results: TestResult[]; passed: number; total: number }`
  - `ApiRequest.tests: { script: string }` and `ApiResponse.tests?: TestReport`
  - `setTestScript(s: string): void` from `requestEdit.ts` (used by Task 5)

- [ ] **Step 1: Write the failing test**

Create `/Users/rakali/_pprojects/primrose/frontend/src/tests/request/testScript.test.ts`:

```ts
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { setTestScript } from '../../lib/request/requestEdit';
import { dirty, request } from '../../lib/workspace/state';
import type { ApiRequest } from '../../lib/shared/types';

function blank(): ApiRequest {
  return {
    method: 'GET',
    url: '',
    query: {},
    headers: {},
    body: { type: 'json', content: '' },
    vars: {},
    tests: { script: '' },
  };
}

describe('setTestScript', () => {
  beforeEach(() => {
    request.set(blank());
    dirty.set(false);
  });

  it('stores the script on the request and marks it dirty', () => {
    setTestScript('assert res.status == 200');
    expect(get(request)?.tests.script).toBe('assert res.status == 200');
    expect(get(dirty)).toBe(true);
  });

  it('does nothing without an open request', () => {
    request.set(null);
    setTestScript('assert 1');
    expect(get(request)).toBeNull();
    expect(get(dirty)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/rakali/_pprojects/primrose/frontend && npm test`
Expected: FAIL — `setTestScript` is not exported (and TS error on `tests` in ApiRequest).

- [ ] **Step 3: Add the types**

In `/Users/rakali/_pprojects/primrose/frontend/src/lib/shared/types.ts`:

Add to `ApiRequest` after the `vars` field:

```ts
  // post-response Starlark assertions, saved with the request
  tests: { script: string };
```

Add to `ApiResponse` after `size: number;`:

```ts
  // assertion results; absent when the request has no test script
  tests?: TestReport;
```

Add after the `RunRecord` interface:

```ts
export interface TestResult {
  line: number;
  source: string;
  ok: boolean;
  message: string;
}

export interface TestReport {
  results: TestResult[];
  passed: number;
  total: number;
}
```

- [ ] **Step 4: Add the setter and store defaults**

In `/Users/rakali/_pprojects/primrose/frontend/src/lib/request/requestEdit.ts`, after `setVar`:

```ts
export function setTestScript(s: string) {
  edit((r) => (r.tests = { script: s }));
}
```

In `/Users/rakali/_pprojects/primrose/frontend/src/lib/workspace/requests.ts`:

- In `selectRequest`, after `r.vars = r.vars ?? {};` add:

```ts
      r.tests = r.tests ?? { script: '' }; // absent in files from before tests existed
```

- In `newRequest`, in the `request.set({...})` literal after `vars: {},` add:

```ts
    tests: { script: '' },
```

- [ ] **Step 5: Run the tests and the type check**

Run: `cd /Users/rakali/_pprojects/primrose/frontend && npm test && npm run check`
Expected: tests PASS; `svelte-check` reports no new errors. If `npm run check` flags other places constructing an `ApiRequest` literal without `tests` (search: `grep -rn "vars: {}" src`), add `tests: { script: '' },` there too.

- [ ] **Step 6: Commit**

```bash
cd /Users/rakali/_pprojects/primrose && git add frontend/src/lib/shared/types.ts frontend/src/lib/request/requestEdit.ts frontend/src/lib/workspace/requests.ts frontend/src/tests/request/testScript.test.ts && git commit -m "feat(tests): frontend request/response types and script setter"
```

---

### Task 5: Request-side "Tests" tab with Python-highlighted editor

**Files:**
- Modify: `/Users/rakali/_pprojects/primrose/frontend/package.json` (via npm install)
- Modify: `/Users/rakali/_pprojects/primrose/frontend/src/lib/editor/CodeEditor.svelte`
- Create: `/Users/rakali/_pprojects/primrose/frontend/src/lib/request/TestsEditor.svelte`
- Modify: `/Users/rakali/_pprojects/primrose/frontend/src/lib/request/RequestView.svelte`
- Test: `/Users/rakali/_pprojects/primrose/frontend/src/tests/request/testsEditor.dom.test.ts` (new)

**Interfaces:**
- Consumes: `setTestScript` from Task 4; `CodeEditor` props `value/onChange/lang/envVars/placeholder`.
- Produces: `CodeEditor` accepts `lang: 'json' | 'text' | 'python'`; `TestsEditor.svelte` (no props — reads the `request` store); RequestView tab id `'tests'`.

- [ ] **Step 1: Install the legacy-modes package**

```bash
cd /Users/rakali/_pprojects/primrose/frontend && npm install @codemirror/legacy-modes
```

Expected: `@codemirror/legacy-modes` appears in `package.json` dependencies.

- [ ] **Step 2: Write the failing DOM test**

Create `/Users/rakali/_pprojects/primrose/frontend/src/tests/request/testsEditor.dom.test.ts` (same pattern as `searchpanel.dom.test.ts`):

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { mount, unmount } from 'svelte';
import TestsEditor from '../../lib/request/TestsEditor.svelte';
import { request } from '../../lib/workspace/state';

describe('TestsEditor', () => {
  it('shows the saved script and edits flow back to the request store', async () => {
    request.set({
      method: 'GET',
      url: '',
      query: {},
      headers: {},
      body: { type: 'json', content: '' },
      vars: {},
      tests: { script: 'assert res.status == 200' },
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const comp = mount(TestsEditor, { target: host });
    await Promise.resolve();
    const cm = host.querySelector('.cm-content');
    expect(cm?.textContent).toContain('assert res.status == 200');
    unmount(comp);
    request.set(null);
  });

  it('renders the placeholder for an empty script', async () => {
    request.set({
      method: 'GET',
      url: '',
      query: {},
      headers: {},
      body: { type: 'json', content: '' },
      vars: {},
      tests: { script: '' },
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const comp = mount(TestsEditor, { target: host });
    await Promise.resolve();
    expect(host.querySelector('.cm-placeholder')?.textContent).toContain('assert res.status == 200');
    expect(get(request)?.tests.script).toBe('');
    unmount(comp);
    request.set(null);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd /Users/rakali/_pprojects/primrose/frontend && npm test`
Expected: FAIL — cannot resolve `../../lib/request/TestsEditor.svelte`.

- [ ] **Step 4: Teach CodeEditor python**

In `/Users/rakali/_pprojects/primrose/frontend/src/lib/editor/CodeEditor.svelte`:

Change the imports (add `StreamLanguage` to the existing `@codemirror/language` import and add the python mode):

```ts
  import { StreamLanguage, syntaxHighlighting } from '@codemirror/language';
  import { python } from '@codemirror/legacy-modes/mode/python';
```

Change the lang prop:

```ts
  export let lang: 'json' | 'text' | 'python' = 'text';
```

In `extensions()`, extend the non-single-line branch:

```ts
      if (lang === 'json') {
        ext.push(json(), syntaxHighlighting(jsonHighlightStyle), lintGutter(), linter(jsonSyntaxErrors));
      } else if (lang === 'python') {
        // Starlark is Python syntax; the legacy stream mode is enough for
        // highlighting and reuses the JSON highlight colors
        ext.push(StreamLanguage.define(python), syntaxHighlighting(jsonHighlightStyle));
      }
```

- [ ] **Step 5: Create TestsEditor.svelte**

Create `/Users/rakali/_pprojects/primrose/frontend/src/lib/request/TestsEditor.svelte`:

```svelte
<script lang="ts">
  // The request's post-response assertion script (Starlark, Python syntax).
  // Runs sandboxed in the Go backend after each send; {{env}} vars resolve
  // in the script text like they do in bodies.
  import CodeEditor from '../editor/CodeEditor.svelte';
  import { setTestScript } from './requestEdit';
  import { activeEnvVars, request } from '../workspace/state';
</script>

{#if $request}
  <CodeEditor
    value={$request.tests?.script ?? ''}
    onChange={setTestScript}
    lang="python"
    envVars={$activeEnvVars}
    placeholder={'assert res.status == 200\nassert "json" in res.headers["content-type"]'} />
  <p class="hint">Starlark (Python syntax). Each top-level assert becomes one result; res has status, headers, body, duration_ms, size, url.</p>
{/if}

<style>
  .hint {
    color: var(--text-ghost);
    font-size: 12px;
    margin: 0;
  }
</style>
```

- [ ] **Step 6: Add the tab to RequestView**

In `/Users/rakali/_pprojects/primrose/frontend/src/lib/request/RequestView.svelte`:

Add the import:

```ts
  import TestsEditor from './TestsEditor.svelte';
```

Change the tab list:

```ts
  type Tab = 'query' | 'body' | 'headers' | 'variables' | 'tests';
  const TABS: Tab[] = ['query', 'body', 'headers', 'variables', 'tests'];
```

Change the keydown guard so ⌘5–7 stay with the response pane:

```ts
  // ⌘1–4 switch the first four request tabs (⌘5–7 belong to the response
  // pane, so the tests tab has no shortcut)
  function onKeydown(e: KeyboardEvent) {
    if (!(e.metaKey || e.ctrlKey)) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 4) {
      e.preventDefault();
      tab = TABS[n - 1];
    }
  }
```

Change the panel chain — the `{:else}` currently renders `EnvPanel`; make it explicit and add tests:

```svelte
  {:else if tab === 'variables'}
    <EnvPanel />
  {:else}
    <TestsEditor />
  {/if}
```

- [ ] **Step 7: Run the tests and type check**

Run: `cd /Users/rakali/_pprojects/primrose/frontend && npm test && npm run check`
Expected: PASS, no new check errors.

- [ ] **Step 8: Commit**

```bash
cd /Users/rakali/_pprojects/primrose && git add frontend/package.json frontend/package-lock.json frontend/src/lib/editor/CodeEditor.svelte frontend/src/lib/request/TestsEditor.svelte frontend/src/lib/request/RequestView.svelte frontend/src/tests/request/testsEditor.dom.test.ts && git commit -m "feat(tests): request-side tests tab with python-highlighted editor"
```

---

### Task 6: Response-side "Tests" tab with badge and results list

**Files:**
- Create: `/Users/rakali/_pprojects/primrose/frontend/src/lib/response/testReport.ts`
- Create: `/Users/rakali/_pprojects/primrose/frontend/src/lib/response/TestResults.svelte`
- Modify: `/Users/rakali/_pprojects/primrose/frontend/src/lib/ui/TabBar.svelte`
- Modify: `/Users/rakali/_pprojects/primrose/frontend/src/lib/response/ResponsePane.svelte`
- Test: `/Users/rakali/_pprojects/primrose/frontend/src/tests/response/testReport.test.ts` (new)
- Test: `/Users/rakali/_pprojects/primrose/frontend/src/tests/response/testResults.dom.test.ts` (new)

**Interfaces:**
- Consumes: `TestReport`/`TestResult` types from Task 4; `ApiResponse.tests` populated by Task 3's backend.
- Produces:
  - `testBadge(r: TestReport): { text: string; ok: boolean }` in `testReport.ts`
  - `TabBar` gains optional prop `badges: Record<string, { text: string; ok: boolean }>` (default `{}`; existing call sites unaffected)
  - `TestResults.svelte` with prop `report: TestReport`

- [ ] **Step 1: Write the failing badge test**

Create `/Users/rakali/_pprojects/primrose/frontend/src/tests/response/testReport.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { testBadge } from '../../lib/response/testReport';

describe('testBadge', () => {
  it('is green (ok) when all pass', () => {
    expect(testBadge({ results: [], passed: 3, total: 3 })).toEqual({ text: '3/3', ok: true });
  });

  it('is red (not ok) on any failure', () => {
    expect(testBadge({ results: [], passed: 1, total: 3 })).toEqual({ text: '1/3', ok: false });
  });

  it('an empty report counts as ok', () => {
    expect(testBadge({ results: [], passed: 0, total: 0 })).toEqual({ text: '0/0', ok: true });
  });
});
```

- [ ] **Step 2: Write the failing results-list DOM test**

Create `/Users/rakali/_pprojects/primrose/frontend/src/tests/response/testResults.dom.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import TestResults from '../../lib/response/TestResults.svelte';

describe('TestResults', () => {
  it('lists each assertion with source, status and failure message', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const comp = mount(TestResults, {
      target: host,
      props: {
        report: {
          passed: 1,
          total: 2,
          results: [
            { line: 1, source: 'assert res.status == 200', ok: true, message: '' },
            { line: 2, source: 'assert res.body["ok"]', ok: false, message: 'assertion failed' },
          ],
        },
      },
    });
    const items = host.querySelectorAll('li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('assert res.status == 200');
    expect(items[0].classList.contains('fail')).toBe(false);
    expect(items[1].classList.contains('fail')).toBe(true);
    expect(items[1].textContent).toContain('assertion failed');
    unmount(comp);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd /Users/rakali/_pprojects/primrose/frontend && npm test`
Expected: FAIL — cannot resolve `testReport.ts` / `TestResults.svelte`.

- [ ] **Step 4: Implement the badge helper**

Create `/Users/rakali/_pprojects/primrose/frontend/src/lib/response/testReport.ts`:

```ts
import type { TestReport } from '../shared/types';

// The tests tab badge: "passed/total", green only when nothing failed.
export function testBadge(r: TestReport): { text: string; ok: boolean } {
  return { text: `${r.passed}/${r.total}`, ok: r.passed === r.total };
}
```

- [ ] **Step 5: Implement TestResults.svelte**

Create `/Users/rakali/_pprojects/primrose/frontend/src/lib/response/TestResults.svelte`:

```svelte
<script lang="ts">
  // One row per assert statement: its source text, pass/fail mark, and the
  // failure message when it failed.
  import type { TestReport } from '../shared/types';

  export let report: TestReport;
</script>

<ul class="results">
  {#each report.results as r, i (i)}
    <li class:fail={!r.ok}>
      <span class="mark">{r.ok ? '✓' : '✗'}</span>
      <div class="detail">
        <code>{r.source}</code>
        {#if !r.ok && r.message}
          <span class="msg">{r.message}</span>
        {/if}
      </div>
    </li>
  {/each}
</ul>

<style>
  .results {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow-y: auto;
    min-height: 0;
  }
  .results li {
    display: flex;
    gap: 8px;
    align-items: baseline;
    font-size: 12.5px;
  }
  .mark {
    color: var(--green-text);
    font-weight: 600;
  }
  li.fail .mark {
    color: var(--red-text);
  }
  .detail {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  code {
    font-family: var(--mono);
    color: var(--text-soft);
    word-break: break-all;
  }
  .msg {
    color: var(--red-text);
    font-size: 12px;
  }
</style>
```

- [ ] **Step 6: Add badges to TabBar**

In `/Users/rakali/_pprojects/primrose/frontend/src/lib/ui/TabBar.svelte`, add the prop and render the badge:

```svelte
<script lang="ts">
  export let tabs: string[];
  export let active: string;
  export let onSelect: (tab: string) => void;
  export let accent = 'var(--green)';
  // optional per-tab count badge, e.g. tests "3/3" (green) or "1/3" (red)
  export let badges: Record<string, { text: string; ok: boolean }> = {};
</script>

<nav class="tabs" style="--tab-accent: {accent}">
  {#each tabs as t (t)}
    <button class:active={t === active} on:click={() => onSelect(t)}>
      {t[0].toUpperCase() + t.slice(1)}
      {#if badges[t]}
        <span class="badge" class:fail={!badges[t].ok}>{badges[t].text}</span>
      {/if}
    </button>
  {/each}
</nav>
```

Add to the existing `<style>` block:

```css
  .badge {
    font-family: var(--mono);
    font-size: 10.5px;
    padding: 1px 6px;
    border-radius: 8px;
    margin-left: 4px;
    background: var(--green-bg);
    color: var(--green-text);
  }
  .badge.fail {
    background: var(--red-bg);
    color: var(--red-text);
  }
```

- [ ] **Step 7: Wire the tab into ResponsePane**

In `/Users/rakali/_pprojects/primrose/frontend/src/lib/response/ResponsePane.svelte`:

Add the imports:

```ts
  import TestResults from './TestResults.svelte';
  import { testBadge } from './testReport';
```

Replace the tab constants block:

```ts
  type Tab = 'response' | 'headers' | 'timeline' | 'tests';
  const BASE_TABS: Tab[] = ['response', 'headers', 'timeline'];
```

Replace the reactive block at the bottom of the script (keep `lastRuns`/`viewedIdx` as they are) with:

```ts
  $: current = runs[viewedIdx] ?? null;
  // the tests tab only exists when the viewed run actually ran assertions
  $: report = current?.response?.tests ?? null;
  $: TABS = report ? [...BASE_TABS, 'tests' as Tab] : BASE_TABS;
  $: badges = report ? { tests: testBadge(report) } : {};
  $: if (tab === 'tests' && !report) tab = 'response';
```

(The `onKeydown` handler already uses `TABS.length`, so ⌘8 reaches the tests tab when present — no change needed there.)

Pass the badges to the tab bar:

```svelte
  <TabBar tabs={TABS} active={tab} onSelect={(t) => (tab = t as Tab)} accent="var(--orange)" {badges} />
```

Change the panel chain's final branch from `{:else}` (Timeline) to:

```svelte
    {:else if tab === 'timeline'}
      <Timeline
        {runs}
        {viewedIdx}
        onView={(i) => {
          viewedIdx = i;
          tab = 'response';
        }} />
    {:else if report}
      <TestResults {report} />
    {/if}
```

- [ ] **Step 8: Run the full frontend suite and type check**

Run: `cd /Users/rakali/_pprojects/primrose/frontend && npm test && npm run check`
Expected: all tests PASS, no new check errors.

- [ ] **Step 9: Run the full Go suite one last time**

Run: `cd /Users/rakali/_pprojects/primrose && go test ./...`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
cd /Users/rakali/_pprojects/primrose && git add frontend/src/lib/response/ frontend/src/lib/ui/TabBar.svelte frontend/src/tests/response/testReport.test.ts frontend/src/tests/response/testResults.dom.test.ts && git commit -m "feat(tests): response tests tab with pass/fail badge and results list"
```

---

## Verification against the spec (§2)

- `[tests]` TOML storage — Task 3 (round-trip test).
- Sandboxed `go.starlark.net` execution, new `internal/tests/` package — Tasks 1–2.
- Runs after SendRequest only with a non-empty script — Task 3 Step 7.
- `res` object with status / lowercase headers / parsed-JSON body / duration_ms / size / url — Task 2.
- `{{env_var}}` interpolation via `collection.Resolve` — Task 3 Step 5 (+ test).
- Per-assert reporting, loop = one entry, runtime errors = failed entry, failures don't stop the rest — Tasks 1–2 (table tests).
- Results `{line, source, ok, message}` + counts on the response — Tasks 2–3.
- Request "Tests" tab, CodeEditor + python highlighting, dirty tracking/stash (via the shared `edit()`/`request` store, which the stash already snapshots) — Tasks 4–5.
- Response "Tests" tab, visibility, green/red `passed/total` badge, results list — Task 6.
- Go table-driven tests incl. non-JSON bodies and env interpolation; Vitest badge/results/visibility — Tasks 1–6.
