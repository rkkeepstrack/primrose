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

func TestRunErrorInHelperAttributedToScriptLine(t *testing.T) {
	script := strings.Join([]string{
		`def helper():`,
		`    return res.body["missing"]`,
		``,
		`assert res.status == 200`,
		`x = helper()`,
	}, "\n")
	rep := Run(script, input())
	if rep.Total != 2 || rep.Passed != 1 {
		t.Fatalf("passed/total = %d/%d, want 1/2; results: %+v", rep.Passed, rep.Total, rep.Results)
	}
	last := rep.Results[len(rep.Results)-1]
	if last.Ok || last.Message == "" {
		t.Errorf("error entry = %+v (want ok=false with error text)", last)
	}
	if last.Line < 1 || last.Line > 5 {
		t.Errorf("error line = %d, want a line inside the user script (1-5)", last.Line)
	}
}

func TestRunDirectCheckWithEmptyListDoesNotPanic(t *testing.T) {
	rep := Run(`_check(1, "sneaky", [])`, input())
	if rep.Total != 1 || rep.Passed != 0 {
		t.Fatalf("passed/total = %d/%d, want 0/1; results: %+v", rep.Passed, rep.Total, rep.Results)
	}
	if rep.Results[0].Ok {
		t.Errorf("empty-list _check must report a failure, got %+v", rep.Results[0])
	}
}

func TestRunEmptyScriptEmptyReport(t *testing.T) {
	rep := Run("", input())
	if rep.Total != 0 || rep.Passed != 0 || len(rep.Results) != 0 {
		t.Errorf("empty script must produce an empty report, got %+v", rep)
	}
}
