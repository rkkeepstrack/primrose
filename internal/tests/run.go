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

// scriptFilename names the user's script in Starlark positions; error
// attribution keys off it to find frames in the user's code.
const scriptFilename = "tests"

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
		// a direct _check call with an empty list (only possible by
		// bypassing instrument) must not panic the runner
		if parts.Len() == 0 {
			if r.Ok {
				r.Ok = false
				r.Message = "assertion failed"
			}
			return starlark.None, nil
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
	_, err := starlark.ExecFileOptions(fileOpts, thread, scriptFilename, instrument(script), predeclared)
	if err != nil {
		line, msg := 0, err.Error()
		if ee, ok := err.(*starlark.EvalError); ok {
			msg = ee.Msg
			// pick the innermost frame that is in the user's script, so an
			// error raised inside a helper (or a builtin) is attributed to a
			// line the user can see; fall back to the deepest frame
			if n := len(ee.CallStack); n > 0 {
				line = int(ee.CallStack.At(n - 1).Pos.Line)
				for i := n - 1; i >= 0; i-- {
					if pos := ee.CallStack.At(i).Pos; pos.Filename() == scriptFilename {
						line = int(pos.Line)
						break
					}
				}
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
