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
