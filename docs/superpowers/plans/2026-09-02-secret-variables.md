# Secret Variables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Environments can declare variables as secret; secret values live in a gitignored `<env>.secrets.toml` sibling file, resolve like normal vars, and are masked everywhere the UI shows resolved request data.

**Architecture:** The Go `internal/env` package learns to read/write the sibling secrets file and merge its values into the environment's vars, so the existing `collection.Resolve` pipeline needs zero changes. The `Environment` struct carries the declared secret names and the declared-but-missing names to the frontend. The frontend masks secret values at render time only (env editor value fields, response request-headers view, Timeline URLs) — the real HTTP request always uses real values.

**Tech Stack:** Go 1.x + BurntSushi/toml (backend), Wails v2 bindings, Svelte 5 + TypeScript + Vitest (frontend).

**Spec:** `docs/superpowers/specs/2026-09-02-sticky-tests-secrets-history-design.md` — implement **section 3 only** ("Secret variables") plus its Testing notes.

## Global Constraints

- Committed env file declares secrets as `[secrets]` table with `vars = ["name", …]`; values live in `environments/<name>.secrets.toml` (flat top-level `key = "value"` pairs).
- Declared-but-missing secrets resolve to empty string and are flagged on the returned environment struct.
- `.gitignore` handling: append `environments/*.secrets.toml` once, only if the collection is a git repo or already has a `.gitignore`; never create files gratuitously; idempotent.
- Saving rewrites both files in one save (atomic secret↔normal toggle); secret values are written only to the secrets file.
- Masking: secret values never render in the response pane's request-headers view or the Timeline — show the `{{name}}` placeholder instead. The real request uses real values.
- No encryption at rest (gitignored plaintext, Bruno-style).
- Go tests: `go test ./...` from repo root. Frontend tests: `cd frontend && npm test`.
- Do not change the existing `{{var}}` / `:var` syntax contract (`internal/collection/resolve.go` ↔ `frontend/src/lib/request/vars.ts`).
- Match existing code style: hand-written TOML serialization via `internal/tomlutil`, table-lite Go tests with `t.TempDir()`, Vitest DOM tests via `mount`/`unmount` from `svelte`.

---

### Task 1: `env.List` reads secrets files

**Files:**
- Modify: `internal/env/env.go`
- Test: `internal/env/env_test.go`

**Interfaces:**
- Consumes: existing `env.List(root string) ([]Environment, error)`.
- Produces: `Environment` struct gains `Secrets []string` (json `secrets`, declared names in file order) and `MissingSecrets []string` (json `missingSecrets`, declared names with no value in the secrets file). `Environment.Vars` now contains merged secret values (missing ones as `""`). `*.secrets.toml` files are never listed as environments. Later tasks (2, 4) rely on exactly these field names and JSON tags.

- [ ] **Step 1: Write the failing tests**

Append to `internal/env/env_test.go`:

```go
func TestListMergesSecrets(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "environments")
	os.MkdirAll(dir, 0o755)
	os.WriteFile(filepath.Join(dir, "staging.toml"), []byte(
		"[vars]\napi_url = \"https://api.staging\"\n\n[secrets]\nvars = [\"api_token\", \"db_pass\"]\n",
	), 0o644)
	os.WriteFile(filepath.Join(dir, "staging.secrets.toml"), []byte(
		"api_token = \"sk-abc123\"\n",
	), 0o644)

	envs, err := List(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(envs) != 1 || envs[0].Name != "staging" {
		t.Fatalf("secrets file must not list as an environment: %v", envs)
	}
	e := envs[0]
	if e.Vars["api_token"] != "sk-abc123" {
		t.Errorf("secret value not merged: %q", e.Vars["api_token"])
	}
	if e.Vars["api_url"] != "https://api.staging" {
		t.Errorf("normal var lost: %q", e.Vars["api_url"])
	}
	if v, ok := e.Vars["db_pass"]; !ok || v != "" {
		t.Errorf("missing secret should resolve to empty string, got %q ok=%v", v, ok)
	}
	if len(e.Secrets) != 2 || e.Secrets[0] != "api_token" || e.Secrets[1] != "db_pass" {
		t.Errorf("declared secrets: %v", e.Secrets)
	}
	if len(e.MissingSecrets) != 1 || e.MissingSecrets[0] != "db_pass" {
		t.Errorf("missing secrets: %v", e.MissingSecrets)
	}
}

func TestListNoSecretsDeclared(t *testing.T) {
	root := t.TempDir()
	if err := Save(root, "prod", map[string]string{"a": "1"}, nil, nil); err != nil {
		t.Fatal(err)
	}
	envs, err := List(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(envs[0].Secrets) != 0 || len(envs[0].MissingSecrets) != 0 {
		t.Errorf("want empty (non-nil) secret slices, got %v / %v", envs[0].Secrets, envs[0].MissingSecrets)
	}
	if envs[0].Secrets == nil || envs[0].MissingSecrets == nil {
		t.Error("slices must be non-nil so JSON encodes [] not null")
	}
}
```

Note: `TestListNoSecretsDeclared` already uses the 5-arg `Save` from Task 2. To keep this task self-contained, change the `Save` signature in this task (Step 3 below) but leave its secrets-writing body for Task 2.

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./internal/env/ -run TestList -v`
Expected: FAIL — compile error (`e.Secrets` undefined, `Save` argument count).

- [ ] **Step 3: Implement**

In `internal/env/env.go`:

Extend the struct and file model:

```go
// Environment is one file in a collection's environments/ directory.
// Headers are environment-wide defaults inherited by every request while
// this environment is active (auth lives here, typically).
// Secrets lists the vars declared secret in the committed file; their
// values are merged into Vars from the gitignored <name>.secrets.toml.
// MissingSecrets are declared secrets with no local value (resolve to "").
type Environment struct {
	Name           string            `json:"name"`
	Path           string            `json:"path"`
	Vars           map[string]string `json:"vars"`
	Headers        map[string]string `json:"headers"`
	Secrets        []string          `json:"secrets"`
	MissingSecrets []string          `json:"missingSecrets"`
}

type envFile struct {
	Vars    map[string]string `toml:"vars"`
	Headers map[string]string `toml:"headers"`
	Secrets struct {
		Vars []string `toml:"vars"`
	} `toml:"secrets"`
}

const secretsSuffix = ".secrets.toml"

// path of an environment's gitignored secrets sibling file.
func secretsFilePath(root, name string) string {
	return filepath.Join(root, dirName, name+secretsSuffix)
}
```

In the `List` loop, skip secrets files (add right after the existing `.toml` suffix check):

```go
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".toml") || strings.HasSuffix(e.Name(), secretsSuffix) {
			continue
		}
```

After the `f.Headers == nil` default block, merge secrets before appending:

```go
		name := strings.TrimSuffix(e.Name(), ".toml")
		secretVals := map[string]string{}
		if _, err := toml.DecodeFile(secretsFilePath(root, name), &secretVals); err != nil && !os.IsNotExist(err) {
			return nil, fmt.Errorf("reading %s%s: %w", name, secretsSuffix, err)
		}
		secrets := f.Secrets.Vars
		if secrets == nil {
			secrets = []string{}
		}
		missing := []string{}
		for _, s := range secrets {
			if v, ok := secretVals[s]; ok {
				f.Vars[s] = v
			} else {
				f.Vars[s] = ""
				missing = append(missing, s)
			}
		}
		envs = append(envs, Environment{
			Name:           name,
			Path:           path,
			Vars:           f.Vars,
			Headers:        f.Headers,
			Secrets:        secrets,
			MissingSecrets: missing,
		})
```

(Remove the old `envs = append(...)` block this replaces.)

Change the `Save` signature only (body handling of `secrets` comes in Task 2 — for now accept and ignore the parameter):

```go
// Save writes an environment file (creating environments/ if needed).
// The name is sanitized to a safe filename. Secret values go to the
// gitignored <name>.secrets.toml sibling; the committed file only lists
// their names.
func Save(root, name string, vars, headers, secrets map[string]string) error {
```

Update the one internal caller: none in this package. Update `app.go` `SaveEnvironment` to keep the build green:

```go
// SaveEnvironment writes an environment file back to disk.
func (a *App) SaveEnvironment(root, name string, vars, headers, secrets map[string]string) error {
	return env.Save(root, name, vars, headers, secrets)
}
```

Update existing tests' `Save` calls in `env_test.go` — every `Save(root, name, vars, headers)` gains a trailing `nil` (e.g. `Save(root, "staging", vars, map[string]string{"Authorization": "Bearer {{token}}"}, nil)`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./...`
Expected: PASS (all packages — `app.go` compiles with the new signature).

- [ ] **Step 5: Commit**

```bash
git add internal/env/env.go internal/env/env_test.go app.go
git commit -m "feat(env): merge gitignored secrets files into environment vars"
```

---

### Task 2: `env.Save` writes secrets; sibling file follows rename/delete/duplicate

**Files:**
- Modify: `internal/env/env.go`
- Test: `internal/env/env_test.go`

**Interfaces:**
- Consumes: Task 1's `Save(root, name string, vars, headers, secrets map[string]string) error`, `secretsFilePath`, `Environment.Secrets/MissingSecrets`.
- Produces: `Save` writes `[secrets] vars = [...]` to the main file and non-empty values to `<name>.secrets.toml` (removing that file when no secrets are declared); `Delete`/`Rename`/`Duplicate` remove/rename/copy the sibling file. Task 5's frontend save relies on this exact `Save` behavior.

- [ ] **Step 1: Write the failing tests**

Append to `internal/env/env_test.go`:

```go
func TestSaveSecretsRoundTrip(t *testing.T) {
	root := t.TempDir()
	err := Save(root, "staging",
		map[string]string{"api_url": "https://api.staging"},
		nil,
		map[string]string{"api_token": "sk-abc123", "db_pass": ""})
	if err != nil {
		t.Fatal(err)
	}

	// committed file holds names only, never values
	main, _ := os.ReadFile(filepath.Join(root, "environments", "staging.toml"))
	if strings.Contains(string(main), "sk-abc123") {
		t.Fatal("secret value leaked into committed env file")
	}
	if !strings.Contains(string(main), "[secrets]") {
		t.Errorf("missing [secrets] section:\n%s", main)
	}

	// secrets file holds only non-empty values
	sec, err := os.ReadFile(filepath.Join(root, "environments", "staging.secrets.toml"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(sec), "sk-abc123") || strings.Contains(string(sec), "db_pass") {
		t.Errorf("secrets file content:\n%s", sec)
	}

	envs, _ := List(root)
	e := envs[0]
	if e.Vars["api_token"] != "sk-abc123" || e.Vars["db_pass"] != "" {
		t.Errorf("merged vars: %v", e.Vars)
	}
	if len(e.Secrets) != 2 {
		t.Errorf("declared: %v", e.Secrets)
	}
	if len(e.MissingSecrets) != 1 || e.MissingSecrets[0] != "db_pass" {
		t.Errorf("missing: %v", e.MissingSecrets)
	}
}

func TestSaveSecretToggleRoundTrip(t *testing.T) {
	root := t.TempDir()
	// start: token is secret
	if err := Save(root, "s", map[string]string{"a": "1"}, nil, map[string]string{"token": "xyz"}); err != nil {
		t.Fatal(err)
	}
	// toggle secret -> normal: value moves into the committed file, secrets file goes away
	if err := Save(root, "s", map[string]string{"a": "1", "token": "xyz"}, nil, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, "environments", "s.secrets.toml")); !os.IsNotExist(err) {
		t.Error("secrets file should be removed when nothing is declared secret")
	}
	envs, _ := List(root)
	if envs[0].Vars["token"] != "xyz" || len(envs[0].Secrets) != 0 {
		t.Errorf("after toggle to normal: %v / %v", envs[0].Vars, envs[0].Secrets)
	}
	// toggle back normal -> secret
	if err := Save(root, "s", map[string]string{"a": "1"}, nil, map[string]string{"token": "xyz"}); err != nil {
		t.Fatal(err)
	}
	main, _ := os.ReadFile(filepath.Join(root, "environments", "s.toml"))
	if strings.Contains(string(main), "xyz") {
		t.Error("value must leave the committed file when toggled secret")
	}
	envs, _ = List(root)
	if envs[0].Vars["token"] != "xyz" {
		t.Errorf("merged after toggle back: %v", envs[0].Vars)
	}
}

func TestSecretsFileFollowsEnvFile(t *testing.T) {
	root := t.TempDir()
	if err := Save(root, "s", map[string]string{}, nil, map[string]string{"token": "xyz"}); err != nil {
		t.Fatal(err)
	}

	dup, err := Duplicate(root, "s")
	if err != nil {
		t.Fatal(err)
	}
	envs, _ := List(root)
	for _, e := range envs {
		if e.Name == dup && e.Vars["token"] != "xyz" {
			t.Errorf("duplicate lost secret: %v", e.Vars)
		}
	}

	if err := Rename(root, "s", "t"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, "environments", "t.secrets.toml")); err != nil {
		t.Error("rename must move the secrets file")
	}

	if err := Delete(root, "t"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, "environments", "t.secrets.toml")); !os.IsNotExist(err) {
		t.Error("delete must remove the secrets file")
	}
}
```

Add `"strings"` to the test file's imports.

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./internal/env/ -run 'TestSaveSecrets|TestSaveSecretToggle|TestSecretsFileFollows' -v`
Expected: FAIL — `[secrets]` section not written, secrets file never created.

- [ ] **Step 3: Implement**

In `Save` (after `writeSection("vars", vars)`, before the headers block):

```go	
	secretNames := make([]string, 0, len(secrets))
	for k := range secrets {
		secretNames = append(secretNames, k)
	}
	sort.Strings(secretNames)
	if len(secretNames) > 0 {
		b.WriteString("\n[secrets]\nvars = [")
		for i, k := range secretNames {
			if i > 0 {
				b.WriteString(", ")
			}
			b.WriteString(tomlutil.String(k))
		}
		b.WriteString("]\n")
	}
```

At the end of `Save`, replace the final `return os.WriteFile(...)` with:

```go
	if err := os.WriteFile(filepath.Join(dir, name+".toml"), []byte(b.String()), 0o644); err != nil {
		return err
	}

	// both files rewritten in one save: toggling secret<->normal is atomic
	secPath := secretsFilePath(root, name)
	if len(secretNames) == 0 {
		err := os.Remove(secPath)
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	var sb strings.Builder
	for _, k := range secretNames {
		if secrets[k] == "" {
			continue // declared but missing stays missing
		}
		fmt.Fprintf(&sb, "%s = %s\n", tomlutil.Key(k), tomlutil.String(secrets[k]))
	}
	return os.WriteFile(secPath, []byte(sb.String()), 0o600)
}
```

Update `Delete`, `Rename`, `Duplicate` to carry the sibling:

```go
// Delete removes an environment file and its secrets sibling.
func Delete(root, name string) error {
	if err := os.Remove(envPath(root, name)); err != nil {
		return err
	}
	if err := os.Remove(secretsFilePath(root, name)); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
```

In `Rename`, replace the final `return os.Rename(...)` with:

```go
	if err := os.Rename(envPath(root, oldName), dest); err != nil {
		return err
	}
	if err := os.Rename(secretsFilePath(root, oldName), secretsFilePath(root, newName)); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
```

In `Duplicate`, replace the final `return newName, os.WriteFile(...)` with:

```go
	if err := os.WriteFile(envPath(root, newName), data, 0o644); err != nil {
		return "", err
	}
	if sec, err := os.ReadFile(secretsFilePath(root, name)); err == nil {
		if err := os.WriteFile(secretsFilePath(root, newName), sec, 0o600); err != nil {
			return "", err
		}
	}
	return newName, nil
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./...`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/env/env.go internal/env/env_test.go
git commit -m "feat(env): write secret values to gitignored sibling file"
```

---

### Task 3: gitignore coverage on collection open + pipeline resolution test

**Files:**
- Modify: `internal/env/env.go`
- Modify: `app.go:187-211` (`OpenCollectionDialog`, `OpenCollection`)
- Test: `internal/env/env_test.go`

**Interfaces:**
- Consumes: Task 1/2 `env` package state.
- Produces: `env.EnsureSecretsIgnored(root string) error`, called on every collection open. No later task depends on it.

- [ ] **Step 1: Write the failing tests**

Append to `internal/env/env_test.go`:

```go
func TestEnsureSecretsIgnored(t *testing.T) {
	// no .git, no .gitignore: do nothing, create nothing
	root := t.TempDir()
	if err := EnsureSecretsIgnored(root); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, ".gitignore")); !os.IsNotExist(err) {
		t.Error("must not create .gitignore in a non-repo without one")
	}

	// git repo without .gitignore: create it with the pattern
	repo := t.TempDir()
	os.MkdirAll(filepath.Join(repo, ".git"), 0o755)
	if err := EnsureSecretsIgnored(repo); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(repo, ".gitignore"))
	if err != nil || !strings.Contains(string(data), "environments/*.secrets.toml") {
		t.Fatalf("pattern not written: %q, %v", data, err)
	}

	// idempotent: running again appends nothing
	before := string(data)
	if err := EnsureSecretsIgnored(repo); err != nil {
		t.Fatal(err)
	}
	data, _ = os.ReadFile(filepath.Join(repo, ".gitignore"))
	if string(data) != before {
		t.Errorf("not idempotent:\nbefore %q\nafter  %q", before, data)
	}

	// existing .gitignore without trailing newline: append cleanly
	plain := t.TempDir()
	os.WriteFile(filepath.Join(plain, ".gitignore"), []byte("node_modules"), 0o644)
	if err := EnsureSecretsIgnored(plain); err != nil {
		t.Fatal(err)
	}
	data, _ = os.ReadFile(filepath.Join(plain, ".gitignore"))
	if string(data) != "node_modules\nenvironments/*.secrets.toml\n" {
		t.Errorf("append: %q", data)
	}
}
```

And the full-pipeline resolution test (secrets interpolate exactly like normal vars — URL, query, headers, body):

```go
func TestSecretsResolveThroughPipeline(t *testing.T) {
	root := t.TempDir()
	if err := Save(root, "s",
		map[string]string{"base": "https://api.example"},
		nil,
		map[string]string{"token": "sk-42"}); err != nil {
		t.Fatal(err)
	}
	envs, _ := List(root)

	r := &collection.Request{
		Method:  "GET",
		URL:     "{{base}}/items",
		Query:   map[string]string{"key": "{{token}}"},
		Headers: map[string]string{"Authorization": "Bearer {{token}}"},
		Body:    collection.Body{Type: "json", Content: `{"t":"{{token}}"}`},
	}
	out := collection.Resolve(r, envs[0].Vars, nil)
	if out.URL != "https://api.example/items" ||
		out.Query["key"] != "sk-42" ||
		out.Headers["Authorization"] != "Bearer sk-42" ||
		out.Body.Content != `{"t":"sk-42"}` {
		t.Errorf("resolved: %+v", out)
	}
}
```

Add `"primrose/internal/collection"` to the test imports.

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./internal/env/ -run 'TestEnsureSecretsIgnored|TestSecretsResolveThroughPipeline' -v`
Expected: FAIL — `EnsureSecretsIgnored` undefined. (Check the `collection.Request`/`Body` field names against `internal/collection` if the pipeline test fails to compile — adjust the test, not the types.)

- [ ] **Step 3: Implement**

In `internal/env/env.go`:

```go
const ignorePattern = "environments/*.secrets.toml"

// EnsureSecretsIgnored makes sure the collection's .gitignore covers the
// secrets files. Appends the pattern once when the collection is a git
// repo or already has a .gitignore; otherwise does nothing (no gratuitous
// file creation).
func EnsureSecretsIgnored(root string) error {
	gi := filepath.Join(root, ".gitignore")
	data, err := os.ReadFile(gi)
	if os.IsNotExist(err) {
		if _, statErr := os.Stat(filepath.Join(root, ".git")); statErr != nil {
			return nil
		}
		return os.WriteFile(gi, []byte(ignorePattern+"\n"), 0o644)
	}
	if err != nil {
		return err
	}
	for _, line := range strings.Split(string(data), "\n") {
		if strings.TrimSpace(line) == ignorePattern {
			return nil
		}
	}
	out := string(data)
	if out != "" && !strings.HasSuffix(out, "\n") {
		out += "\n"
	}
	return os.WriteFile(gi, []byte(out+ignorePattern+"\n"), 0o644)
}
```

In `app.go`, wire it into both open paths (inside the existing `if err == nil` blocks):

```go
	col, err := collection.Open(dir)
	if err == nil {
		a.watchCollection(dir)
		_ = env.EnsureSecretsIgnored(dir) // best effort; never blocks opening
	}
```

(same two lines with `root` in `OpenCollection`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./...`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/env/env.go internal/env/env_test.go app.go
git commit -m "feat(env): gitignore secrets files on collection open"
```

---

### Task 4: Frontend plumbing — types, bindings, secret helpers

**Files:**
- Modify: `frontend/src/lib/shared/types.ts:66-71` (Environment interface)
- Modify: `frontend/wailsjs/go/main/App.d.ts:53`, `frontend/wailsjs/go/main/App.js:93-95`
- Modify: `frontend/src/lib/workspace/environments.ts:56-60,88-90`
- Modify: `frontend/src/lib/workspace/state.ts` (add `activeEnv` derived)
- Create: `frontend/src/lib/shared/secrets.ts`
- Test: `frontend/src/tests/shared/secrets.test.ts`

**Interfaces:**
- Consumes: Go JSON fields `secrets`, `missingSecrets` (Task 1); 5-arg `SaveEnvironment` (Task 1).
- Produces (later tasks use these exact names):
  - `Environment.secrets: string[]`, `Environment.missingSecrets: string[]`
  - `secrets.ts`: `secretValues(env: Environment | null): Record<string, string>`, `maskSecrets(s: string, secretVals: Record<string, string>): string`, `maskEntries(entries: Record<string, string>, secretVals: Record<string, string>): Record<string, string>`
  - `state.ts`: `activeEnv` derived store (`Environment | null`)
  - `workspace/environments.ts`: `saveEnvironment(root, name, vars, headers, secrets)` (5 args)

- [ ] **Step 1: Write the failing test**

Create `frontend/src/tests/shared/secrets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { maskEntries, maskSecrets, secretValues } from '../../lib/shared/secrets';
import type { Environment } from '../../lib/shared/types';

const env: Environment = {
  name: 'staging',
  path: '/c/environments/staging.toml',
  vars: { api_url: 'https://api.staging', api_token: 'sk-abc123', db_pass: '' },
  headers: {},
  secrets: ['api_token', 'db_pass'],
  missingSecrets: ['db_pass'],
};

describe('secretValues', () => {
  it('returns only secrets that have a value', () => {
    expect(secretValues(env)).toEqual({ api_token: 'sk-abc123' });
  });

  it('is empty for null env', () => {
    expect(secretValues(null)).toEqual({});
  });
});

describe('maskSecrets', () => {
  it('replaces every occurrence with the placeholder', () => {
    expect(maskSecrets('Bearer sk-abc123 and sk-abc123', { api_token: 'sk-abc123' })).toBe(
      'Bearer {{api_token}} and {{api_token}}',
    );
  });

  it('leaves strings without secrets alone and ignores empty values', () => {
    expect(maskSecrets('hello', { api_token: 'sk-abc123', empty: '' })).toBe('hello');
  });
});

describe('maskEntries', () => {
  it('masks values of a header map', () => {
    expect(maskEntries({ Authorization: 'Bearer sk-abc123', Accept: 'application/json' }, secretValues(env))).toEqual({
      Authorization: 'Bearer {{api_token}}',
      Accept: 'application/json',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- secrets`
Expected: FAIL — cannot resolve `../../lib/shared/secrets`.

- [ ] **Step 3: Implement**

Create `frontend/src/lib/shared/secrets.ts`:

```ts
// Secret variables: pure helpers shared by the env editor, the response
// pane's request-headers view and the Timeline. Masking is render-only —
// the real HTTP request always uses the real values.

import type { Environment } from './types';

// name -> value for the environment's secrets that actually have a value
// (declared-but-missing secrets have nothing to mask).
export function secretValues(env: Environment | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of env?.secrets ?? []) {
    const v = env!.vars[name];
    if (v) out[name] = v;
  }
  return out;
}

// replaces every occurrence of each secret value with its {{name}} placeholder
export function maskSecrets(s: string, secretVals: Record<string, string>): string {
  for (const [name, value] of Object.entries(secretVals)) {
    if (value) s = s.split(value).join(`{{${name}}}`);
  }
  return s;
}

export function maskEntries(entries: Record<string, string>, secretVals: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, maskSecrets(v, secretVals)]));
}
```

In `frontend/src/lib/shared/types.ts`, extend the interface:

```ts
export interface Environment {
  name: string;
  path: string;
  vars: Record<string, string>;
  headers: Record<string, string>;
  secrets: string[];
  missingSecrets: string[];
}
```

In `frontend/src/lib/workspace/state.ts`, below the `inheritedHeaders` derived (line 43):

```ts
export const activeEnv = derived([envs, activeEnvName], ([$envs, $name]) => $envs.find((e) => e.name === $name) ?? null);
```

Update the generated Wails bindings (Wails regenerates them on `wails dev`; edit them now so the frontend type-checks):

`frontend/wailsjs/go/main/App.d.ts` line 53:

```ts
export function SaveEnvironment(arg1:string,arg2:string,arg3:Record<string, string>,arg4:Record<string, string>,arg5:Record<string, string>):Promise<void>;
```

`frontend/wailsjs/go/main/App.js` lines 93-95:

```js
export function SaveEnvironment(arg1, arg2, arg3, arg4, arg5) {
  return window['go']['main']['App']['SaveEnvironment'](arg1, arg2, arg3, arg4, arg5);
}
```

In `frontend/src/lib/workspace/environments.ts`:

```ts
export async function saveEnvironment(
  root: string,
  name: string,
  vars: Record<string, string>,
  headers: Record<string, string>,
  secrets: Record<string, string>,
) {
  await operateThenReload(root, () => SaveEnvironment(root, name, vars, headers, secrets));
}
```

and in `createEnvironment`, change the call to `await SaveEnvironment(root, name, {}, {}, {});`.

- [ ] **Step 4: Run tests and type-check**

Run: `cd frontend && npm test -- secrets` then `cd frontend && npm test`
Expected: `secrets.test.ts` PASS. The full run may now flag `App.svelte`'s 3-arg `onSave={... saveEnvironment(envRoot, name, vars, headers)}` — if the suite type-checks Svelte files and fails, apply the one-line `App.svelte` fix from Task 5 Step 3 now instead (move it forward, don't duplicate it).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/shared/secrets.ts frontend/src/lib/shared/types.ts frontend/src/lib/workspace/state.ts frontend/src/lib/workspace/environments.ts frontend/wailsjs/go/main/App.d.ts frontend/wailsjs/go/main/App.js frontend/src/tests/shared/secrets.test.ts
git commit -m "feat(frontend): secret helpers, Environment secret fields, 5-arg SaveEnvironment"
```

---

### Task 5: Environment editor — secret toggle, masked value, reveal

**Files:**
- Modify: `frontend/src/lib/ui/KeyValueEditor.svelte`
- Modify: `frontend/src/lib/environments/EnvDetail.svelte`
- Modify: `frontend/src/lib/environments/EnvironmentEditor.svelte`
- Modify: `frontend/src/lib/workspace/state.ts:21` (envDrafts type)
- Modify: `frontend/src/App.svelte:189` (onSave handler)
- Test: `frontend/src/tests/ui/keyValueSecrets.dom.test.ts`

**Interfaces:**
- Consumes: `saveEnvironment(root, name, vars, headers, secrets)` and `Environment.secrets` from Task 4.
- Produces: `KeyValueEditor` optional props `secretKeys: string[]` and `onToggleSecret: ((key: string) => void) | null`; `EnvironmentEditor`'s `onSave` prop becomes `(name, vars, headers, secrets: Record<string, string>) => Promise<void> | void`. No later task depends on these.

- [ ] **Step 1: Write the failing DOM test**

Create `frontend/src/tests/ui/keyValueSecrets.dom.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import KeyValueEditor from '../../lib/ui/KeyValueEditor.svelte';

describe('KeyValueEditor secrets', () => {
  it('masks secret values, reveals on toggle, and reports secret toggles', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const toggled: string[] = [];
    const comp = mount(KeyValueEditor, {
      target: host,
      props: {
        entries: { api_url: 'https://x', api_token: 'sk-abc' },
        onChange: () => {},
        secretKeys: ['api_token'],
        onToggleSecret: (key: string) => toggled.push(key),
      },
    });
    await Promise.resolve();

    const valueInputs = [...host.querySelectorAll<HTMLInputElement>('td input[placeholder="value"]')];
    const tokenInput = valueInputs.find((i) => i.value === 'sk-abc')!;
    expect(tokenInput.type).toBe('password');
    const urlInput = valueInputs.find((i) => i.value === 'https://x')!;
    expect(urlInput.type).toBe('text');

    // secret marker on the secret row only
    expect(host.querySelectorAll('button.secret-toggle.is-secret')).toHaveLength(1);

    // reveal
    host.querySelector<HTMLButtonElement>('button.reveal')!.click();
    await Promise.resolve();
    expect(tokenInput.type).toBe('text');

    // toggle secret <-> normal reports the key
    host.querySelector<HTMLButtonElement>('button.secret-toggle.is-secret')!.click();
    await Promise.resolve();
    expect(toggled).toEqual(['api_token']);

    unmount(comp);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- keyValueSecrets`
Expected: FAIL — `tokenInput.type` is `"text"`, no `.secret-toggle` buttons.

- [ ] **Step 3: Implement**

**`frontend/src/lib/ui/KeyValueEditor.svelte`** — add props, reveal state and per-row controls. Add to the script block:

```ts
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import Lock from '@lucide/svelte/icons/lock';
  import LockOpen from '@lucide/svelte/icons/lock-open';
  // keys whose values are secret: masked input + reveal toggle. When
  // onToggleSecret is set, every row gets a lock button to flip the flag.
  export let secretKeys: string[] = [];
  export let onToggleSecret: ((key: string) => void) | null = null;

  let revealed: Record<string, boolean> = {};
  $: secretSet = new Set(secretKeys);
```

Replace the row's value cell (`<td><input placeholder="value" bind:value={row.value} on:input={emit} /></td>`) with:

```svelte
        <td class="value-cell">
          {#if secretSet.has(row.key) && !revealed[row.key]}
            <input placeholder="value" type="password" bind:value={row.value} on:input={emit} />
          {:else}
            <input placeholder="value" type="text" bind:value={row.value} on:input={emit} />
          {/if}
          {#if secretSet.has(row.key)}
            <button
              class="reveal"
              title={revealed[row.key] ? 'Hide value' : 'Reveal value'}
              on:click={() => (revealed = { ...revealed, [row.key]: !revealed[row.key] })}>
              {#if revealed[row.key]}<EyeOff size={13} strokeWidth={2} />{:else}<Eye size={13} strokeWidth={2} />{/if}
            </button>
          {/if}
        </td>
```

(Two separate `<input>` branches because `type` can't be dynamic on an input with two-way binding in Svelte.)

In the actions cell, before the existing remove button:

```svelte
          {#if onToggleSecret}
            <button
              class="secret-toggle"
              class:is-secret={secretSet.has(row.key)}
              title={secretSet.has(row.key) ? 'Secret — click to make normal' : 'Make secret'}
              on:click={() => onToggleSecret?.(row.key)}>
              {#if secretSet.has(row.key)}<Lock size={13} strokeWidth={2} />{:else}<LockOpen size={13} strokeWidth={2} />{/if}
            </button>
          {/if}
```

Widen the actions column and style the new buttons (add to the style block; keep existing rules):

```css
  td.actions {
    width: 64px;
    white-space: nowrap;
  }
  .value-cell {
    position: relative;
  }
  .value-cell .reveal {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    border: none;
    background: none;
    display: flex;
    align-items: center;
    cursor: pointer;
    color: var(--text-faint);
  }
  .secret-toggle {
    border: none;
    background: none;
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    color: var(--text-faint);
  }
  .secret-toggle.is-secret {
    color: var(--purple-soft);
  }
```

**`frontend/src/lib/environments/EnvDetail.svelte`** — pass the props through to the vars table only (headers stay normal). Add to props:

```ts
  export let secretKeys: string[];
  export let onToggleSecret: (key: string) => void;
```

and change the vars editor line to:

```svelte
    <KeyValueEditor entries={filtered} {onChange} {secretKeys} {onToggleSecret} />
```

**`frontend/src/lib/environments/EnvironmentEditor.svelte`** — carry a secrets draft:

Change the `onSave` prop type:

```ts
  export let onSave: (
    name: string,
    vars: Record<string, string>,
    headers: Record<string, string>,
    secrets: Record<string, string>,
  ) => Promise<void> | void;
```

Add draft state next to `headersDraft`:

```ts
  let secretsDraft: string[] | null = null;
```

In the `$: if (active && draftFor !== active.name)` block, add inside both branches:

```ts
      secretsDraft = [...(stash.secrets ?? active.secrets)];
```
(stash branch) and
```ts
      secretsDraft = [...active.secrets];
```
(fresh branch).

Extend `dirty` (order-insensitive on the secret list):

```ts
  function sameList(a: string[], b: string[]): boolean {
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
  }

  $: dirty =
    active && draft && headersDraft && secretsDraft
      ? !sameVars(draft, active.vars) || !sameVars(headersDraft, active.headers) || !sameList(secretsDraft, active.secrets)
      : false;
```

Extend the stash sync and helpers:

```ts
  $: if (dirty && draftFor && draft && headersDraft && secretsDraft) stashEnvDraft(draftFor, draft, headersDraft, secretsDraft);
  else if (!dirty) clearEnvDraft();

  function stashEnvDraft(name: string, vars: Record<string, string>, headers: Record<string, string>, secrets: string[]) {
    envDrafts.update((m) => ({ ...m, [root]: { name, vars, headers, secrets } }));
  }
```

Add the toggle handler:

```ts
  function toggleSecret(key: string) {
    if (!secretsDraft) return;
    secretsDraft = secretsDraft.includes(key) ? secretsDraft.filter((k) => k !== key) : [...secretsDraft, key];
  }
```

Change `save()` to split the draft:

```ts
  async function save() {
    if (!active || !draft || !headersDraft || !secretsDraft) return;
    const isSecret = new Set(secretsDraft);
    const plain = Object.fromEntries(Object.entries(draft).filter(([k]) => !isSecret.has(k)));
    const secrets = Object.fromEntries(Object.entries(draft).filter(([k]) => isSecret.has(k)));
    await onSave(active.name, plain, headersDraft, secrets);
    // resync from the saved file so the rows show the alphabetical order
    // the file was written in
    draftFor = null;
  }
```

Pass the new props in the template:

```svelte
    <EnvDetail
      slot="right"
      active={!!(active && draft)}
      bind:search
      {filtered}
      {dirty}
      {headersDraft}
      secretKeys={secretsDraft ?? []}
      onToggleSecret={toggleSecret}
      onChange={handleChange}
      onHeadersChange={(h) => (headersDraft = h)}
      onSave={save} />
```

**`frontend/src/lib/workspace/state.ts`** line 21 — extend the stash type:

```ts
export const envDrafts = writable<
  Record<string, { name: string; vars: Record<string, string>; headers: Record<string, string>; secrets?: string[] }>
>({});
```

**`frontend/src/App.svelte`** line 189 — pass secrets through:

```svelte
        onSave={(name, vars, headers, secrets) => saveEnvironment(envRoot, name, vars, headers, secrets)}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test`
Expected: PASS, including `keyValueSecrets.dom.test.ts` and all pre-existing tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/ui/KeyValueEditor.svelte frontend/src/lib/environments/EnvDetail.svelte frontend/src/lib/environments/EnvironmentEditor.svelte frontend/src/lib/workspace/state.ts frontend/src/App.svelte frontend/src/tests/ui/keyValueSecrets.dom.test.ts
git commit -m "feat(env-editor): secret toggle, masked values with reveal"
```

---

### Task 6: Masking in response views + missing-secrets warning

**Files:**
- Modify: `frontend/src/lib/response/ResponsePane.svelte:59,64-70`
- Modify: `frontend/src/lib/response/Timeline.svelte`
- Modify: `frontend/src/lib/sidebar/SidebarHeader.svelte`
- Test: `frontend/src/tests/response/timelineMask.dom.test.ts`

**Interfaces:**
- Consumes: `maskSecrets`, `maskEntries`, `secretValues` from `lib/shared/secrets.ts` (Task 4); `activeEnv` derived store (Task 4); `activeEnvName`/`envs` already in `workspace/state.ts`.
- Produces: `Timeline` gains optional prop `mask: (s: string) => string` (default identity). Nothing downstream.

- [ ] **Step 1: Write the failing DOM test**

Create `frontend/src/tests/response/timelineMask.dom.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import Timeline from '../../lib/response/Timeline.svelte';
import { maskSecrets } from '../../lib/shared/secrets';
import type { RunRecord } from '../../lib/shared/types';

describe('Timeline secret masking', () => {
  it('renders URLs and redirects through the mask', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const runs = [
      {
        at: new Date(),
        error: null,
        response: {
          status: 200,
          durationMs: 12,
          requestUrl: 'https://api.example/items?key=sk-abc123',
          finalUrl: 'https://api.example/items?key=sk-abc123',
          redirects: ['https://api.example/v2?key=sk-abc123'],
          headers: {},
        },
      },
    ] as unknown as RunRecord[];
    const comp = mount(Timeline, {
      target: host,
      props: {
        runs,
        viewedIdx: 0,
        onView: () => {},
        mask: (s: string) => maskSecrets(s, { api_token: 'sk-abc123' }),
      },
    });
    await Promise.resolve();

    expect(host.textContent).not.toContain('sk-abc123');
    expect(host.textContent).toContain('{{api_token}}');
    // both the main URL and the redirect hop are masked
    expect(host.querySelectorAll('.row-url').length).toBe(2);

    unmount(comp);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- timelineMask`
Expected: FAIL — `sk-abc123` appears in the rendered output (mask prop unknown, ignored).

- [ ] **Step 3: Implement Timeline masking**

In `frontend/src/lib/response/Timeline.svelte`, add the prop:

```ts
  // render-only masking of secret values (identity when no env is active)
  export let mask: (s: string) => string = (s) => s;
```

and route the two URL renders through it:

```svelte
        {#if run.response?.requestUrl ?? run.response?.finalUrl}
          <span class="row-url">→ {mask(run.response.requestUrl ?? run.response.finalUrl)}</span>
        {/if}
        {#if run.response?.redirects?.length}
          {#each run.response.redirects as hop}
            <span class="row-url redirect" title="Followed redirect">↪ {mask(hop)}</span>
          {/each}
        {/if}
```

In `frontend/src/lib/response/ResponsePane.svelte`, add imports and a derived map:

```ts
  import { activeEnv, sending } from '../workspace/state';
  import { maskEntries, maskSecrets, secretValues } from '../shared/secrets';
```

(merge with the existing `import { sending } from '../workspace/state';`), then in the script body:

```ts
  $: secretVals = secretValues($activeEnv);
```

Change line 59 to mask request headers:

```svelte
        <ResponseHeaders headers={current.response.headers} requestHeaders={maskEntries(current.response.requestHeaders ?? {}, secretVals)} />
```

and pass the mask to the Timeline:

```svelte
      <Timeline
        {runs}
        {viewedIdx}
        mask={(s) => maskSecrets(s, secretVals)}
        onView={(i) => {
          viewedIdx = i;
          tab = 'response';
        }} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- timelineMask`
Expected: PASS.

- [ ] **Step 5: Add the missing-secrets warning to the environment selector**

In `frontend/src/lib/sidebar/SidebarHeader.svelte`, import `activeEnv`:

```ts
  import { activeEnv, activeEnvName, activeRoot, envs } from '../workspace/state';
```

Inside the trigger button, after the env name (before the chevron):

```svelte
      <button slot="trigger" class="env-label" title="Switch environment">
        {$activeEnvName ?? 'No environment'}
        {#if $activeEnv && $activeEnv.missingSecrets.length > 0}
          <span
            class="secret-warn"
            title={`Missing local values for: ${$activeEnv.missingSecrets.join(', ')} (environments/${$activeEnv.name}.secrets.toml)`}>
            {$activeEnv.missingSecrets.length} secret{$activeEnv.missingSecrets.length === 1 ? '' : 's'} missing
          </span>
        {/if}
        <ChevronDown class="chev" size={8} strokeWidth={2} />
      </button>
```

Add to the component's style block:

```css
  .secret-warn {
    font-size: 10px;
    color: var(--red);
    white-space: nowrap;
  }
```

(If the project has no `--red` variable, check `frontend/src/style.css` for the theme's warning color name — `KeyValueEditor.svelte` already uses `var(--red)`, so it exists.)

- [ ] **Step 6: Run the full suites**

Run: `cd frontend && npm test` and `go test ./...`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/response/ResponsePane.svelte frontend/src/lib/response/Timeline.svelte frontend/src/lib/sidebar/SidebarHeader.svelte frontend/src/tests/response/timelineMask.dom.test.ts
git commit -m "feat(secrets): mask secret values in request headers and Timeline, warn on missing secrets"
```

---

## Self-review notes

- Spec §3 coverage: file format (T1/T2), merge + missing flag (T1), gitignore (T3), atomic toggle save (T2), pipeline resolution incl. test scripts — scripts resolve via the same merged `envVars` map, no extra work (T3 test proves the pipeline), env editor masking/toggle (T5), selector warning (T6), request-headers/Timeline masking (T6), real request uses real values (masking is render-only; `send.ts` passes unmasked `activeEnvVars` — unchanged).
- The Vitest suite name filters (`npm test -- secrets`) assume the standard Vitest CLI filename filter; if the project's `npm test` script doesn't forward args, run `npx vitest run <name>` inside `frontend/` instead.
