package tomlutil

import (
	"testing"

	"github.com/BurntSushi/toml"
)

func TestStringProducesValidTOML(t *testing.T) {
	cases := []string{
		"plain",
		"with \"quotes\"",
		"back\\slash",
		"tab\tand\nnewline",
		"control\x07char",
		"del\x7fchar",
		"ümlauts and 中文",
		"",
	}
	for _, in := range cases {
		doc := "v = " + String(in) + "\n"
		var out struct {
			V string `toml:"v"`
		}
		if _, err := toml.Decode(doc, &out); err != nil {
			t.Errorf("invalid TOML for %q: %v\ndoc: %s", in, err, doc)
			continue
		}
		if out.V != in {
			t.Errorf("round trip %q -> %q", in, out.V)
		}
	}
}

func TestKey(t *testing.T) {
	if Key("simple-key_1") != "simple-key_1" {
		t.Error("bare key should stay bare")
	}
	if Key("has space") != `"has space"` {
		t.Errorf("got %s", Key("has space"))
	}
	if Key("") != `""` {
		t.Errorf("empty key: %s", Key(""))
	}
}
