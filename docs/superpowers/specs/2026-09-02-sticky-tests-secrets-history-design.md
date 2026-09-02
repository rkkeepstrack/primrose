# Design: Sticky JSON Context, Starlark Tests, Secret Variables, 100-Request History Heatmap

**Date:** 2026-09-02
**Status:** Approved in brainstorming; ready for implementation planning.

Four independent features for Primrose. Each can be built and shipped separately; suggested order is 3 → 2 → 4 → 1 (secrets and tests touch the Go core, history builds on existing recency tracking, sticky context is pure frontend and riskiest to get pixel-right).

---

## 1. Sticky JSON context in the response viewer

VS Code/WebStorm-style "sticky scroll": while scrolling a nested JSON response, the enclosing object/array property lines stay pinned at the top of the viewer. Implemented as a CodeMirror 6 extension — **no custom editor**.

### Approach

New extension `frontend/src/lib/editor/stickyPath.ts`:

- On scroll (and doc/fold changes), take the first fully visible line and walk up the Lezer syntax tree (`syntaxTree(state)` from `@codemirror/language`, already a dependency via `@codemirror/lang-json`) collecting enclosing `Object`/`Array` nodes and the line of each node's `Property` name.
- Render those ancestor lines as a stacked overlay pinned to the top of `.cm-scroller`, visually identical to real lines: same font, size, theme, and syntax highlighting (re-render the line content through CM's highlighter, not a plain-text copy).
- Cap at 5 levels; when deeper, keep the deepest 5. Hide entirely when the top visible line is at depth 0.
- Clicking a sticky line scrolls the real line to the top (and moves the cursor there).
- Must coexist with: fold gutter/folded regions (an ancestor inside a folded region uses the fold header line), the custom search panel, and image/raw response modes (extension is only active for JSON mode).
- Styling uses existing CSS variables (`--bg`, `--border`, `--text-soft`, …) plus a 1px bottom border. No other design changes.

### Integration

- `CodeViewer.svelte`: add the extension for JSON mode.
- `CodeEditor.svelte`: reuse for the JSON request body editor (same extension, no special casing).

### Testing

Vitest DOM tests alongside `searchpanel.dom.test.ts`:
- Scrolled nested document shows the correct ancestor chain (names and order).
- Flat document / top of document → no overlay.
- Depth > 5 → deepest 5 shown.
- Click on sticky line jumps to it.

---

## 2. Test assertions (Starlark)

Bruno-style post-response assertions, written in Starlark (Python syntax), run sandboxed in the Go backend.

### Storage (request TOML)

```toml
[tests]
script = """
assert res.status == 200
assert "json" in res.headers["content-type"]
for item in res.body["data"]:
    assert item["id"], "every item needs an id"
"""
```

### Execution — new package `internal/tests/`

- Embeds `go.starlark.net` (pure Go, ~2MB, sandboxed: scripts get no filesystem/network/module access).
- Runs after `SendRequest` receives a response, only when the request has a non-empty script.
- Predefined `res` object:
  - `res.status` (int), `res.headers` (dict, lowercase keys, comma-joined multi-values),
  - `res.body` (parsed JSON as dict/list/scalar; raw string when not JSON),
  - `res.duration_ms` (int), `res.size` (int), `res.url` (final URL string).
- `{{env_var}}` interpolation is applied to the script text before execution, same pipeline as bodies (`collection.Resolve`). Secret vars resolve too (see §3).
- **Per-assert reporting:** the runner rewrites/wraps top-level `assert` statements so each is one pass/fail entry (source line + optional message) and one failure doesn't abort the rest. An `assert` inside a loop/conditional is still a single entry — the first failing iteration fails it, with item context in the message. Runtime errors (typos, missing keys) become a failed entry carrying the error text.
- Results (list of `{line, source, ok, message}` + summary counts) are attached to the `SendRequest` response struct.

### UI

- **Request side:** a "Tests" tab on the request editor using the existing `CodeEditor` with Python highlighting via `@codemirror/legacy-modes` (python mode). Saved with the request like any other field (participates in dirty tracking / unsaved-edit stash).
- **Response side:** a "Tests" tab next to Body/Headers/Timeline, visible only when the request has a script. Tab badge shows `passed/total` — green when all pass, red otherwise. Tab body lists each assertion with its source text, status, and failure message.

### Testing

- Go table-driven tests in `internal/tests/`: passing/failing/mixed scripts, runtime errors, non-JSON bodies, env interpolation, per-assert isolation.
- Vitest: badge rendering, results list, tab visibility.

---

## 3. Secret variables

Environments can declare variables as secret; the shared environment file holds only the names, values live in a gitignored sibling file. Collections become shareable without leaking credentials.

### File format

```toml
# environments/staging.toml   (committed, shared)
[vars]
api_url = "https://api.staging"

[secrets]
vars = ["api_token"]
```

```toml
# environments/staging.secrets.toml   (gitignored, local)
api_token = "sk-abc123"
```

### Go side (`internal/env/`)

- `env.List()` also reads `<name>.secrets.toml` when present; secret values merge into the environment's vars for resolution. Secrets interpolate exactly like normal vars (`{{api_token}}`) in URL, query, headers, body, and test scripts.
- Declared-but-missing secrets resolve to empty string and are flagged in the returned environment struct so the UI can warn.
- On collection open, Primrose ensures `environments/*.secrets.toml` is covered by the collection's `.gitignore`: appends the pattern once if the collection is a git repo or already has a `.gitignore`; otherwise does nothing (no gratuitous file creation).
- Writing: saving a secret value writes only the secrets file; toggling a var secret↔normal moves it between the two files atomically (both files rewritten in one save).

### UI

- Environment editor: secret vars render with a masked value field (`•••••` + reveal toggle) and a "secret" marker. Any var can be toggled secret/normal.
- Environment selector shows a subtle warning when the active environment has declared secrets with no local value ("2 secrets missing").
- **Masking:** secret values never appear in the response pane's request-headers view or the Timeline — rendered as the `{{name}}` placeholder instead. The real HTTP request uses the real value.

### Testing

- Go: merge behavior, missing secrets flag, gitignore idempotence, secret↔normal round-trip, resolution through the full pipeline.
- Vitest: masking in env editor and request-headers/Timeline views, missing-secrets warning.

---

## 4. 100-request history heatmap line

A persistent "quick access memory": a thin strip below the sidebar search bar showing the last 100 opened requests as colored slots.

### Behavior

- Strip ~8px tall, directly below the search input in `Sidebar.svelte`; up to 100 equal-width slots, newest at the left.
- Colors use the existing gradient formula from `treeView.ts` `heatStyle()` (hue 35°→190°, alpha fade), so both heatmaps share one visual language.
- **Deduplicated by recency** (same semantics as `recentPaths`): reopening a request moves it to slot 1; a request occupies at most one slot.
- Hover: popup (existing tooltip styling) with request name + folder path; follows the pointer across slots (scrubbing).
- Click: opens the request and reveals it in the tree (expand parent folders, scroll into view).
- Slots whose file no longer exists are pruned on load and skipped on click.

### Tracking & persistence

- Frontend: extend the `touchRecent()` flow in `shared/stores.ts` with a second list `historyPaths` (cap 100) per collection root. The existing last-10 `recentPaths` heat stays session-only and unchanged.
- Backend: new `SaveHistory(root, paths)` / `LoadHistory(root)` app methods persisting JSON to the app config dir (`os.UserConfigDir()/primrose/history/<hash-of-root>.json`). Nothing is written into the collection folder. Saved debounced on change; loaded when a collection opens.

### Testing

- Vitest: dedupe/cap/ordering of `historyPaths`, pruning of missing files, hover popup content, click-to-open + reveal.
- Go: save/load round-trip, corrupt/missing file tolerance.

---

## Out of scope

- JS scripting, pre-request scripts, or Starlark beyond assertions (no network/fs access from scripts).
- Encryption of secrets at rest (gitignored plaintext file, Bruno-style).
- Changing the existing last-10 heat semantics or any visual redesign.
