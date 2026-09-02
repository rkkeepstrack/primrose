# 100-Request History Heatmap Line Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A persistent thin heatmap strip below the sidebar search bar showing the last 100 opened requests as clickable colored slots, saved per collection in the app config dir.

**Architecture:** A new Go package `internal/history` persists the per-collection path list as JSON under `os.UserConfigDir()/primrose/history/<sha1-of-root>.json` and prunes dead files on load; two new Wails-bound methods (`SaveHistory`/`LoadHistory`) expose it. The frontend grows a second recency list `historyPaths` (cap 100) fed by the existing `touchRecent()` flow, a small sync module that loads history on collection open and saves it debounced, and a `HistoryStrip.svelte` component that renders the slots with the existing `heatStyle` gradient math, a pointer-following hover popup, and click-to-open-and-reveal.

**Tech Stack:** Go 1.x + Wails v2 (backend), Svelte 5 + TypeScript + Vite + Vitest (frontend). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-02-sticky-tests-secrets-history-design.md` — implement **section 4 only** (plus its testing notes).

## Global Constraints

- History cap is exactly **100** entries per collection root, deduplicated by recency, newest first.
- The existing last-10 `recentPaths` heat stays **session-only and unchanged** in semantics (cap 10, drives the tree-row heat and the recents filter exactly as today).
- Strip colors reuse the **existing gradient formula** from `treeView.ts` `heatStyle()` (hue 35°→190° via `(395 - (1 - rank) * 205) % 360`, alpha `0.11 * rank`). No new visual language.
- Nothing history-related is ever written **into the collection folder** — only the app config dir.
- Saves are **debounced**; history is loaded when a collection opens; paths whose files no longer exist are pruned by the **backend on load**.
- No visual redesign; use existing CSS variables and the global `.popover-card` styling.
- Go tests: `go test ./...` from the repo root. Frontend tests: `cd frontend && npm test`.
- Match existing code style: comment tone, Svelte 4-style stores in `.ts` modules, table/`t.Run`-less flat Go tests as in `internal/appstate`.

---

### Task 1: Go `internal/history` package

**Files:**
- Create: `internal/history/history.go`
- Create: `internal/history/history_test.go`

**Interfaces:**
- Consumes: nothing (leaf package; stdlib only).
- Produces: `history.Save(root string, paths []string) error`, `history.Load(root string) ([]string, error)`, `history.Max = 100`. Task 2 binds these into `App`.

- [ ] **Step 1: Write the failing tests**

Create `internal/history/history_test.go`. The `isolateConfigDir` helper mirrors `internal/appstate/appstate_test.go` so `os.UserConfigDir()` points into a temp dir on both darwin and linux.

```go
package history

import (
	"os"
	"path/filepath"
	"testing"
)

func isolateConfigDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("HOME", dir) // darwin: UserConfigDir = $HOME/Library/Application Support
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(dir, ".config"))
	return dir
}

// touchFile creates an empty file (with parent dirs) and returns its path.
func touchFile(t *testing.T, dir, name string) string {
	t.Helper()
	p := filepath.Join(dir, name)
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, nil, 0o644); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestLoadWithoutHistoryFile(t *testing.T) {
	isolateConfigDir(t)
	paths, err := Load("/some/collection")
	if err != nil {
		t.Fatal(err)
	}
	if paths == nil || len(paths) != 0 {
		t.Errorf("want empty non-nil list, got %#v", paths)
	}
}

func TestSaveLoadRoundTripPrunesMissingFiles(t *testing.T) {
	dir := isolateConfigDir(t)
	root := filepath.Join(dir, "col")
	kept := touchFile(t, root, "auth/login.toml")
	gone := filepath.Join(root, "auth/deleted.toml") // never created
	if err := Save(root, []string{kept, gone}); err != nil {
		t.Fatal(err)
	}
	out, err := Load(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != 1 || out[0] != kept {
		t.Errorf("want only the existing file kept, got %#v", out)
	}
}

func TestSaveCapsAtMax(t *testing.T) {
	dir := isolateConfigDir(t)
	root := filepath.Join(dir, "col")
	paths := make([]string, 0, Max+5)
	for i := 0; i < Max+5; i++ {
		paths = append(paths, touchFile(t, root, filepath.Join("r", string(rune('a'+i%26))+string(rune('a'+i/26))+".toml")))
	}
	if err := Save(root, paths); err != nil {
		t.Fatal(err)
	}
	out, err := Load(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != Max {
		t.Errorf("want %d entries after save, got %d", Max, len(out))
	}
	if out[0] != paths[0] {
		t.Errorf("cap must keep the newest (front) entries, got first %q", out[0])
	}
}

func TestLoadCorruptHistoryFallsBack(t *testing.T) {
	dir := isolateConfigDir(t)
	root := filepath.Join(dir, "col")
	p := touchFile(t, root, "a.toml")
	if err := Save(root, []string{p}); err != nil {
		t.Fatal(err)
	}
	// corrupt the file in place
	fp, err := filePath(root)
	if err != nil {
		t.Fatal(err)
	}
	os.WriteFile(fp, []byte("{not json"), 0o644)

	out, err := Load(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != 0 {
		t.Errorf("corrupt history should fall back to empty, got %#v", out)
	}
}

func TestDifferentRootsDoNotCollide(t *testing.T) {
	dir := isolateConfigDir(t)
	rootA, rootB := filepath.Join(dir, "a"), filepath.Join(dir, "b")
	pa := touchFile(t, rootA, "x.toml")
	pb := touchFile(t, rootB, "y.toml")
	if err := Save(rootA, []string{pa}); err != nil {
		t.Fatal(err)
	}
	if err := Save(rootB, []string{pb}); err != nil {
		t.Fatal(err)
	}
	outA, _ := Load(rootA)
	outB, _ := Load(rootB)
	if len(outA) != 1 || outA[0] != pa || len(outB) != 1 || outB[0] != pb {
		t.Errorf("roots collided: %#v / %#v", outA, outB)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./internal/history/`
Expected: FAIL to build with `undefined: Load` (the package doesn't exist yet — create `history.go` with only `package history` first if the compiler complains about no non-test files).

- [ ] **Step 3: Write the implementation**

Create `internal/history/history.go`:

```go
// Package history persists the per-collection "last 100 opened requests"
// list. Files live in the user config dir, keyed by a hash of the
// collection root — never inside the collection itself.
package history

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
)

// Max is the history cap per collection root.
const Max = 100

func filePath(root string) (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	sum := sha1.Sum([]byte(root))
	return filepath.Join(dir, "primrose", "history", hex.EncodeToString(sum[:])+".json"), nil
}

// Save writes the history list (newest first), capped at Max.
func Save(root string, paths []string) error {
	p, err := filePath(root)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	if len(paths) > Max {
		paths = paths[:Max]
	}
	data, err := json.Marshal(paths)
	if err != nil {
		return err
	}
	return os.WriteFile(p, data, 0o644)
}

// Load returns the saved history, pruned of entries whose request files no
// longer exist. A missing or corrupt history file yields an empty list.
func Load(root string) ([]string, error) {
	p, err := filePath(root)
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(p)
	if os.IsNotExist(err) {
		return []string{}, nil
	}
	if err != nil {
		return nil, err
	}
	var paths []string
	if err := json.Unmarshal(data, &paths); err != nil {
		return []string{}, nil // corrupt history: start fresh
	}
	kept := make([]string, 0, len(paths))
	for _, fp := range paths {
		if _, err := os.Stat(fp); err == nil {
			kept = append(kept, fp)
		}
	}
	return kept, nil
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./internal/history/ -v` then `go test ./...`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/history/history.go internal/history/history_test.go
git commit -m "feat: add internal/history package persisting per-collection request history"
```

---

### Task 2: Wails-bound `SaveHistory` / `LoadHistory` app methods

**Files:**
- Modify: `app.go` (append after `SaveUIState`, around line 301)
- Modify (generated): `frontend/wailsjs/go/main/App.d.ts`, `frontend/wailsjs/go/main/App.js`

**Interfaces:**
- Consumes: `history.Save`, `history.Load` from Task 1.
- Produces: JS bindings `LoadHistory(arg1: string): Promise<Array<string>>` and `SaveHistory(arg1: string, arg2: Array<string>): Promise<void>` importable from `../../../wailsjs/go/main/App` — Task 4 depends on these exact names.

- [ ] **Step 1: Add the app methods**

In `app.go`, add `"primrose/internal/history"` to the import block (alphabetically, after `"primrose/internal/env"`), then append after the `SaveUIState` method:

```go
// LoadHistory returns the persisted request history of a collection,
// pruned of request files that no longer exist.
func (a *App) LoadHistory(root string) ([]string, error) {
	return history.Load(root)
}

// SaveHistory persists the request history of a collection (newest first).
func (a *App) SaveHistory(root string, paths []string) error {
	return history.Save(root, paths)
}
```

- [ ] **Step 2: Verify the backend builds and tests pass**

Run: `go build ./... && go test ./...`
Expected: builds, all PASS.

- [ ] **Step 3: Regenerate the wailsjs bindings**

Run: `wails generate module`
Expected: `frontend/wailsjs/go/main/App.d.ts` gains `LoadHistory`/`SaveHistory` declarations.

If the `wails` CLI is unavailable, hand-edit the generated files instead (they follow a mechanical pattern). In `frontend/wailsjs/go/main/App.d.ts`, insert alphabetically:

```ts
export function LoadHistory(arg1:string):Promise<Array<string>>;
```
```ts
export function SaveHistory(arg1:string,arg2:Array<string>):Promise<void>;
```

In `frontend/wailsjs/go/main/App.js`, insert alphabetically (matching the existing functions' exact style in that file):

```js
export function LoadHistory(arg1) {
  return window['go']['main']['App']['LoadHistory'](arg1);
}
```
```js
export function SaveHistory(arg1, arg2) {
  return window['go']['main']['App']['SaveHistory'](arg1, arg2);
}
```

- [ ] **Step 4: Verify the frontend still typechecks**

Run: `cd frontend && npx svelte-check --tsconfig ./tsconfig.json` (or `npm run check` if defined in `frontend/package.json`)
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add app.go frontend/wailsjs/go/main/App.d.ts frontend/wailsjs/go/main/App.js
git commit -m "feat: expose SaveHistory/LoadHistory app methods"
```

---

### Task 3: `historyPaths` store fed by the `touchRecent` flow

**Files:**
- Modify: `frontend/src/lib/shared/stores.ts` (lines 16-40)
- Test: `frontend/src/tests/shared/stores.test.ts`

**Interfaces:**
- Consumes: existing `touchRecent`, `renameRecent` in `stores.ts`.
- Produces: `export const HISTORY_MAX = 100`, `export const historyPaths = writable<Record<string, string[]>>({})`, `export function setHistory(root: string, paths: string[])`. `touchRecent` now also updates `historyPaths`; `renameRecent` renames in it. Tasks 4 and 6 import these exact names.

- [ ] **Step 1: Write the failing tests**

In `frontend/src/tests/shared/stores.test.ts`, extend the import from `'../../lib/shared/stores'` with `HISTORY_MAX, historyPaths, setHistory`, add `historyPaths.set({});` to the existing `beforeEach`, and add this describe block after the `recentPaths` block:

```ts
describe('historyPaths', () => {
  it('touchRecent also feeds the history list, deduped by recency', () => {
    touchRecent('/c', '/c/a');
    touchRecent('/c', '/c/b');
    touchRecent('/c', '/c/a');
    expect(get(historyPaths)['/c']).toEqual(['/c/a', '/c/b']);
  });

  it('caps at HISTORY_MAX while recentPaths keeps its own smaller cap', () => {
    for (let i = 0; i < HISTORY_MAX + 5; i++) touchRecent('/c', `/c/r${i}`);
    expect(get(historyPaths)['/c']).toHaveLength(HISTORY_MAX);
    expect(get(historyPaths)['/c'][0]).toBe(`/c/r${HISTORY_MAX + 4}`);
    expect(get(recentPaths)['/c']).toHaveLength(RECENT_MAX);
  });

  it('keeps a separate list per collection root', () => {
    touchRecent('/c', '/c/a');
    touchRecent('/d', '/d/x');
    expect(get(historyPaths)['/c']).toEqual(['/c/a']);
    expect(get(historyPaths)['/d']).toEqual(['/d/x']);
  });

  it('setHistory replaces a root list and enforces the cap', () => {
    setHistory('/c', Array.from({ length: HISTORY_MAX + 3 }, (_, i) => `/c/r${i}`));
    expect(get(historyPaths)['/c']).toHaveLength(HISTORY_MAX);
    expect(get(historyPaths)['/c'][0]).toBe('/c/r0');
  });

  it('renameRecent renames history entries too', () => {
    touchRecent('/c', '/c/a');
    renameRecent('/c/a', '/c/b');
    expect(get(historyPaths)['/c']).toEqual(['/c/b']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/tests/shared/stores.test.ts`
Expected: FAIL — `historyPaths` is not exported.

- [ ] **Step 3: Implement in `stores.ts`**

Below the existing `recentPaths` declaration (line 17), add:

```ts
// Quick-access history: the last 100 opened requests per collection root,
// most recent first. Persisted via the backend (see workspace/history.ts);
// the last-10 recentPaths heat above stays session-only and unchanged.
export const HISTORY_MAX = 100;
export const historyPaths = writable<Record<string, string[]>>({});

// replaces a root's history wholesale (used when loading from the backend)
export function setHistory(root: string, paths: string[]) {
  historyPaths.update((m) => ({ ...m, [root]: paths.slice(0, HISTORY_MAX) }));
}
```

Replace the body of `touchRecent` so it also feeds the history list:

```ts
export function touchRecent(root: string, path: string) {
  recentPaths.update((m) => {
    const next = [path, ...(m[root] ?? []).filter((p) => p !== path)].slice(0, RECENT_MAX);
    pruneEdits(root, next);
    return { ...m, [root]: next };
  });
  historyPaths.update((m) => ({
    ...m,
    [root]: [path, ...(m[root] ?? []).filter((p) => p !== path)].slice(0, HISTORY_MAX),
  }));
}
```

In `renameRecent`, after the `recentPaths.update(...)` call and before the `unsavedEdits.update(...)` call, add:

```ts
  historyPaths.update((m) =>
    Object.fromEntries(Object.entries(m).map(([root, list]) => [root, list.map((p) => (p === oldPath ? newPath : p))])),
  );
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test`
Expected: all PASS (including the untouched pre-existing store tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/shared/stores.ts frontend/src/tests/shared/stores.test.ts
git commit -m "feat: track 100-entry request history alongside session recents"
```

---

### Task 4: History load-on-open and debounced save sync

**Files:**
- Create: `frontend/src/lib/workspace/history.ts`
- Modify: `frontend/src/lib/workspace/collections.ts` (function `addOpenedCollection`, lines 25-39)
- Test: `frontend/src/tests/workspace/history.test.ts`

**Interfaces:**
- Consumes: `LoadHistory`/`SaveHistory` bindings (Task 2), `historyPaths`, `setHistory` (Task 3).
- Produces: `export async function loadHistory(root: string): Promise<void>` and `export const SAVE_DEBOUNCE_MS = 500`. Collection open calls `loadHistory`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/tests/workspace/history.test.ts` (the `src/tests/workspace/` directory already exists). The wailsjs module is mocked so no Wails runtime is needed:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

const LoadHistory = vi.fn();
const SaveHistory = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../wailsjs/go/main/App', () => ({
  LoadHistory: (...a: unknown[]) => LoadHistory(...a),
  SaveHistory: (...a: unknown[]) => SaveHistory(...a),
}));

import { loadHistory, SAVE_DEBOUNCE_MS } from '../../lib/workspace/history';
import { historyPaths, touchRecent } from '../../lib/shared/stores';

beforeEach(() => {
  vi.useFakeTimers();
  LoadHistory.mockReset();
  SaveHistory.mockClear();
  historyPaths.set({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('loadHistory', () => {
  it('puts the backend list (already pruned there) into the store', async () => {
    LoadHistory.mockResolvedValue(['/c/b.toml', '/c/a.toml']);
    await loadHistory('/c');
    expect(LoadHistory).toHaveBeenCalledWith('/c');
    expect(get(historyPaths)['/c']).toEqual(['/c/b.toml', '/c/a.toml']);
  });

  it('falls back to an empty list when the backend errors', async () => {
    LoadHistory.mockRejectedValue(new Error('boom'));
    await loadHistory('/c');
    expect(get(historyPaths)['/c']).toEqual([]);
  });
});

describe('debounced save', () => {
  it('saves once after a burst of touches, with the latest list', async () => {
    LoadHistory.mockResolvedValue([]);
    await loadHistory('/c');
    touchRecent('/c', '/c/a.toml');
    touchRecent('/c', '/c/b.toml');
    touchRecent('/c', '/c/c.toml');
    expect(SaveHistory).not.toHaveBeenCalled();
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS + 10);
    expect(SaveHistory).toHaveBeenCalledTimes(1);
    expect(SaveHistory).toHaveBeenCalledWith('/c', ['/c/c.toml', '/c/b.toml', '/c/a.toml']);
  });

  it('does not save a root that was never loaded, and not on load itself', async () => {
    LoadHistory.mockResolvedValue(['/c/a.toml']);
    await loadHistory('/c');
    touchRecent('/never-loaded', '/never-loaded/x.toml');
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS + 10);
    expect(SaveHistory).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/tests/workspace/history.test.ts`
Expected: FAIL — cannot resolve `../../lib/workspace/history`.

- [ ] **Step 3: Implement `frontend/src/lib/workspace/history.ts`**

```ts
// Loading and debounced saving of the persisted 100-request history.
// The backend prunes paths whose files no longer exist on load; here we
// only mirror the store into the config-dir file, per collection root.

import { LoadHistory, SaveHistory } from '../../../wailsjs/go/main/App';
import { historyPaths, setHistory } from '../shared/stores';

export const SAVE_DEBOUNCE_MS = 500;

// only roots that finished loading are saved — otherwise opening a
// collection could overwrite its file with a not-yet-loaded empty list
const loaded = new Set<string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const lastSeen = new Map<string, string[]>();
let subscribed = false;

export async function loadHistory(root: string) {
  let paths: string[] = [];
  try {
    paths = (await LoadHistory(root)) ?? [];
  } catch {
    // an unreadable history file is not worth an error dialog; start empty
  }
  setHistory(root, paths);
  lastSeen.set(root, paths.slice(0, 100));
  loaded.add(root);
  if (!subscribed) {
    subscribed = true;
    historyPaths.subscribe(scheduleSaves);
  }
}

function scheduleSaves(m: Record<string, string[]>) {
  for (const [root, paths] of Object.entries(m)) {
    if (!loaded.has(root)) continue;
    const prev = lastSeen.get(root);
    if (prev && prev.length === paths.length && prev.every((p, i) => p === paths[i])) continue;
    lastSeen.set(root, paths);
    clearTimeout(timers.get(root));
    timers.set(
      root,
      setTimeout(() => {
        SaveHistory(root, paths).catch(() => {}); // history loss is tolerable
      }, SAVE_DEBOUNCE_MS),
    );
  }
}
```

Note: `setHistory` (not `lastSeen`) is the store write; `lastSeen` must be set from the same `paths` value so the subscription firing from the load itself is a no-op (second test).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/tests/workspace/history.test.ts`
Expected: PASS.

- [ ] **Step 5: Load history when a collection opens**

In `frontend/src/lib/workspace/collections.ts`, add to the import block:

```ts
import { loadHistory } from './history';
```

and in `addOpenedCollection`, after `await loadEnvironments(col.root);`, add:

```ts
  await loadHistory(col.root);
```

- [ ] **Step 6: Run the full frontend suite**

Run: `cd frontend && npm test`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/workspace/history.ts frontend/src/lib/workspace/collections.ts frontend/src/tests/workspace/history.test.ts
git commit -m "feat: load and debounce-save request history per collection"
```

---

### Task 5: Shared `heatColor` and exported `findRequestNode` in treeView

**Files:**
- Modify: `frontend/src/lib/sidebar/treeView.ts` (lines 88-97 `findRequestNode`, lines 141-152 `heatStyle`)
- Test: `frontend/src/tests/sidebar/treeView.test.ts`

**Interfaces:**
- Consumes: existing `heatStyle` formula.
- Produces: `export function heatColor(rank: number): string` returning the raw `hsla(...)` value, `heatStyle` refactored to use it (behavior unchanged), and `findRequestNode(nodes: TreeNode[], path: string): TreeNode | null` now exported. Task 6 imports both.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/tests/sidebar/treeView.test.ts` (add `heatColor`, `heatStyle`, `findRequestNode` to its import from `'../../lib/sidebar/treeView'`; import `type { TreeNode }` from `'../../lib/shared/types'` if not already imported):

```ts
describe('heatColor', () => {
  it('is the exact color heatStyle wraps in the custom property', () => {
    for (const rank of [1, 0.5, 0.1]) {
      expect(heatStyle(rank)).toBe(`--heat-bg: ${heatColor(rank)}`);
    }
  });

  it('newest is warm orange at full intensity, fading with age', () => {
    expect(heatColor(1)).toBe('hsla(35, 80%, 52%, 0.110)');
    expect(heatColor(0.5)).toBe('hsla(292, 80%, 52%, 0.055)');
  });
});

describe('findRequestNode', () => {
  const tree: TreeNode[] = [
    { name: 'auth', path: '/c/auth', isFolder: true, children: [{ name: 'login', path: '/c/auth/login.toml', isFolder: false }] },
    { name: 'ping', path: '/c/ping.toml', isFolder: false },
  ];

  it('finds nested request nodes and misses folders and unknowns', () => {
    expect(findRequestNode(tree, '/c/auth/login.toml')?.name).toBe('login');
    expect(findRequestNode(tree, '/c/auth')).toBeNull();
    expect(findRequestNode(tree, '/c/gone.toml')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/tests/sidebar/treeView.test.ts`
Expected: FAIL — `heatColor` / `findRequestNode` not exported.

- [ ] **Step 3: Implement**

In `frontend/src/lib/sidebar/treeView.ts`, change `function findRequestNode(` to `export function findRequestNode(` (line 88), and replace the `heatStyle` function (lines 145-152) with:

```ts
// the raw slot/row color for a 0..1 recency rank — shared by the tree-row
// heat and the history strip so both heatmaps speak one visual language
export function heatColor(rank: number): string {
  const hue = (395 - (1 - rank) * 205) % 360;
  const alpha = 0.11 * rank;
  return `hsla(${hue.toFixed(0)}, 80%, 52%, ${alpha.toFixed(3)})`;
}

export function heatStyle(rank: number | undefined): string {
  if (!rank) return '';
  // a custom property (not `background` directly) so the row's :hover rule
  // still wins — inline backgrounds would override it
  return `--heat-bg: ${heatColor(rank)}`;
}
```

(Keep the existing "True heatmap semantics" comment block above `heatColor`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test`
Expected: all PASS (existing heat/tree tests unchanged and green).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/sidebar/treeView.ts frontend/src/tests/sidebar/treeView.test.ts
git commit -m "refactor: extract heatColor and export findRequestNode for the history strip"
```

---

### Task 6: `HistoryStrip.svelte` — strip, hover popup, click-to-open

**Files:**
- Create: `frontend/src/lib/sidebar/HistoryStrip.svelte`
- Modify: `frontend/src/lib/sidebar/Sidebar.svelte` (insert component after the `.search-row` div, line 129)
- Test: `frontend/src/tests/sidebar/historyStrip.svelte.test.ts`

**Interfaces:**
- Consumes: `historyPaths`, `HISTORY_MAX` (Task 3); `heatColor`, `findRequestNode`, `revealRequest` (Task 5 / existing); `selectRequest` from `../workspace/requests`; `activeIdx, activeRoot, collections` from `../workspace/state`.
- Produces: `<HistoryStrip />`, no props — reads all state from stores.

- [ ] **Step 1: Write the failing DOM test**

Create `frontend/src/tests/sidebar/historyStrip.svelte.test.ts` (mocking `requests.ts` keeps the wailsjs runtime out of the test, matching how `popover.svelte.test.ts` mounts components):

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { get } from 'svelte/store';

const selectRequest = vi.fn();
vi.mock('../../lib/workspace/requests', () => ({
  selectRequest: (...a: unknown[]) => selectRequest(...a),
}));

import HistoryStrip from '../../lib/sidebar/HistoryStrip.svelte';
import { historyPaths } from '../../lib/shared/stores';
import { expanded } from '../../lib/sidebar/treeView';
import { activeIdx, collections } from '../../lib/workspace/state';
import type { Collection } from '../../lib/shared/types';

const col: Collection = {
  name: 'c',
  root: '/c',
  tree: [
    { name: 'auth', path: '/c/auth', isFolder: true, children: [{ name: 'login', path: '/c/auth/login.toml', isFolder: false }] },
    { name: 'ping', path: '/c/ping.toml', isFolder: false },
  ],
} as Collection;

function mountStrip() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const comp = mount(HistoryStrip, { target: host });
  flushSync();
  return { host, comp };
}

beforeEach(() => {
  selectRequest.mockClear();
  collections.set([col]);
  activeIdx.set(0);
  expanded.set({});
  historyPaths.set({ '/c': ['/c/auth/login.toml', '/c/ping.toml'] });
});

describe('HistoryStrip', () => {
  it('renders one slot per history entry, newest first, heat-colored', () => {
    const { host, comp } = mountStrip();
    const slots = host.querySelectorAll<HTMLButtonElement>('.slot');
    expect(slots).toHaveLength(2);
    expect(slots[0].getAttribute('aria-label')).toBe('login');
    expect(slots[0].style.background).toContain('hsla');
    unmount(comp);
  });

  it('renders nothing when the collection has no history', () => {
    historyPaths.set({});
    const { host, comp } = mountStrip();
    expect(host.querySelector('.history-strip')).toBeNull();
    unmount(comp);
  });

  it('hover shows the popup with name and folder path, following the pointer', () => {
    const { host, comp } = mountStrip();
    const slots = host.querySelectorAll<HTMLButtonElement>('.slot');
    slots[0].dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 30 }));
    flushSync();
    const tip = host.querySelector('.history-tip')!;
    expect(tip.textContent).toContain('login');
    expect(tip.textContent).toContain('auth');
    // scrubbing to the next slot swaps the content in place
    slots[1].dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 55 }));
    flushSync();
    expect(host.querySelector('.history-tip')!.textContent).toContain('ping');
    host.querySelector('.history-strip')!.dispatchEvent(new MouseEvent('mouseleave'));
    flushSync();
    expect(host.querySelector('.history-tip')).toBeNull();
    unmount(comp);
  });

  it('click opens the request and reveals it in the tree', () => {
    const { host, comp } = mountStrip();
    host.querySelectorAll<HTMLButtonElement>('.slot')[0].click();
    flushSync();
    expect(selectRequest).toHaveBeenCalledTimes(1);
    expect(selectRequest.mock.calls[0][0].path).toBe('/c/auth/login.toml');
    expect(get(expanded)['/c/auth'], 'parent folder should be expanded by reveal').toBe(true);
    unmount(comp);
  });

  it('skips clicks on entries whose file is gone from the tree', () => {
    historyPaths.set({ '/c': ['/c/deleted.toml'] });
    const { host, comp } = mountStrip();
    host.querySelectorAll<HTMLButtonElement>('.slot')[0].click();
    flushSync();
    expect(selectRequest).not.toHaveBeenCalled();
    unmount(comp);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/tests/sidebar/historyStrip.svelte.test.ts`
Expected: FAIL — cannot resolve `HistoryStrip.svelte`.

- [ ] **Step 3: Implement `frontend/src/lib/sidebar/HistoryStrip.svelte`**

```svelte
<script lang="ts">
  // Thin quick-access heatmap: the last 100 opened requests as equal-width
  // slots, newest at the left. Hover scrubs a popup with name + folder,
  // click opens the request and reveals it in the tree.
  import type { TreeNode } from '../shared/types';
  import { historyPaths, HISTORY_MAX } from '../shared/stores';
  import { findRequestNode, heatColor, revealRequest } from './treeView';
  import { selectRequest } from '../workspace/requests';
  import { activeIdx, activeRoot, collections } from '../workspace/state';

  $: root = $activeRoot ?? '';
  $: tree = $collections[$activeIdx]?.tree ?? [];
  $: entries = ($historyPaths[root] ?? []).map((path) => ({ path, node: findRequestNode(tree, path) }));

  let stripEl: HTMLDivElement;
  let hover: { name: string; folder: string; x: number } | null = null;

  // name + folder path (relative to the collection root) for the popup
  function label(entry: { path: string; node: TreeNode | null }): { name: string; folder: string } {
    const rel = entry.path.startsWith(root + '/') ? entry.path.slice(root.length + 1) : entry.path;
    const cut = rel.lastIndexOf('/');
    const name = entry.node?.name ?? (cut === -1 ? rel : rel.slice(cut + 1)).replace(/\.toml$/, '');
    return { name, folder: cut === -1 ? '/' : rel.slice(0, cut) };
  }

  function scrub(e: MouseEvent, entry: { path: string; node: TreeNode | null }) {
    const rect = stripEl?.getBoundingClientRect();
    const x = rect ? Math.max(0, Math.min(e.clientX - rect.left, rect.width - 40)) : 0;
    hover = { ...label(entry), x };
  }

  function open(entry: { path: string; node: TreeNode | null }) {
    if (!entry.node) return; // file vanished mid-session: skip the slot
    revealRequest(entry.path, root);
    selectRequest(entry.node);
  }
</script>

{#if entries.length}
  <div class="history-strip" bind:this={stripEl} role="toolbar" aria-label="Request history" on:mouseleave={() => (hover = null)}>
    {#each entries as entry, i (entry.path)}
      <button
        class="slot"
        style="background: {heatColor((HISTORY_MAX - i) / HISTORY_MAX)}"
        aria-label={label(entry).name}
        on:mousemove={(e) => scrub(e, entry)}
        on:click={() => open(entry)} />
    {/each}
    {#if hover}
      <div class="history-tip popover-card" style="left: {hover.x}px">
        <span class="tip-name">{hover.name}</span>
        <span class="tip-folder">{hover.folder}</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .history-strip {
    position: relative;
    display: flex;
    height: 8px;
    margin-bottom: 12px;
    flex-shrink: 0;
    border-radius: 2px;
    background: var(--bg-hover);
  }
  .slot {
    /* equal-width slots: always 1/100th of the strip, newest at the left */
    flex: 0 0 1%;
    min-width: 0;
    border: none;
    padding: 0;
    cursor: pointer;
  }
  .slot:hover {
    box-shadow: inset 0 0 0 1px var(--orange-strong);
  }
  .history-tip {
    position: absolute;
    top: 12px;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 10px;
    font-size: 12px;
    pointer-events: none;
    white-space: nowrap;
  }
  .tip-name {
    font-weight: 600;
    color: var(--text-strong);
  }
  .tip-folder {
    color: var(--text-soft);
  }
</style>
```

- [ ] **Step 4: Run the DOM test to verify it passes**

Run: `cd frontend && npx vitest run src/tests/sidebar/historyStrip.svelte.test.ts`
Expected: PASS.

- [ ] **Step 5: Mount the strip in the sidebar**

In `frontend/src/lib/sidebar/Sidebar.svelte`: add to the imports

```ts
  import HistoryStrip from './HistoryStrip.svelte';
```

and insert directly after the closing `</div>` of `.search-row` (before `<div class="tree-scroll">`):

```svelte
  <HistoryStrip />
```

- [ ] **Step 6: Run the full suites**

Run: `cd frontend && npm test` and `go test ./...`
Expected: all PASS.

- [ ] **Step 7: Manual smoke check (optional but recommended)**

Run `wails dev`, open a collection, click a few requests: the strip appears below the search bar, newest slot at the left; hover scrubs the popup; clicking a slot opens the request and expands its folders; restart the app and the strip is restored (dead files gone).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/sidebar/HistoryStrip.svelte frontend/src/lib/sidebar/Sidebar.svelte frontend/src/tests/sidebar/historyStrip.svelte.test.ts
git commit -m "feat: 100-request history heatmap strip below the sidebar search"
```

---

## Self-Review Notes

- Spec coverage: strip below search (T6), 100 equal-width slots newest-left (T6), shared `heatStyle` gradient (T5/T6), dedupe-by-recency via `touchRecent` (T3), pointer-following hover popup with name + folder (T6), click opens + reveals (T6), prune on backend load (T1) and skip-on-click (T6), debounced save / load on open (T4), config-dir JSON keyed by sha1 of root (T1/T2), `recentPaths` untouched in semantics (T3 tests assert its cap still holds).
- Type consistency: `historyPaths: Record<string, string[]>`, `setHistory(root, paths)`, `loadHistory(root)`, `heatColor(rank): string`, `findRequestNode(nodes, path): TreeNode | null` are used with the same signatures across Tasks 3-6; Go `Load/Save` match the `app.go` wrappers in Task 2.
