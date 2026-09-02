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
