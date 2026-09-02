# Sticky JSON Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** VS Code-style sticky scroll for JSON in the response viewer and JSON body editor: the enclosing object/array property lines stay pinned at the top while scrolling.

**Architecture:** A single new CodeMirror 6 extension (`frontend/src/lib/editor/stickyPath.ts`) with two layers: a pure function `computeStickyLines(state, topPos)` that walks the Lezer syntax tree upward from the top visible line and returns the ancestor anchor lines, and a `ViewPlugin` that renders those lines as an absolutely-positioned overlay at the top of the editor, re-rendered through the existing `jsonHighlightStyle` via `highlightTree` so the copy is syntax-highlighted identically to real lines. The extension is added only when `lang === 'json'` in `CodeViewer.svelte` and `CodeEditor.svelte`.

**Tech Stack:** Svelte 5, TypeScript, Vite, Vitest (jsdom), CodeMirror 6 (`@codemirror/view` 6.43.6, `@codemirror/language` 6.12.4, `@codemirror/lang-json` 6.0.2), `@lezer/highlight` + `@lezer/common` (transitive deps of `@codemirror/language`, already imported directly elsewhere, e.g. `jsonHighlight.ts`).

**Spec:** `docs/superpowers/specs/2026-09-02-sticky-tests-secrets-history-design.md` — implement **section 1 only** ("Sticky JSON context in the response viewer") plus its testing notes.

## Global Constraints

- Frontend only. Do not touch any Go code or the other spec sections (§2–§4).
- No new npm dependencies; `@lezer/highlight` and `@lezer/common` are already installed transitively (see `jsonHighlight.ts` importing `@lezer/highlight`).
- Cap sticky lines at 5 levels; when deeper, keep the **deepest** 5. Hide the overlay entirely at depth 0 (top of document, flat documents).
- Styling: existing CSS variables only (`--bg`, `--border`, `--text-soft`, `--bg-hover`) plus a 1px bottom border. No other design changes.
- Extension is active only for JSON mode; raw/text and image response modes are untouched.
- Must coexist with code folding (an ancestor line hidden inside a folded region is represented by the fold header line) and with the floating search panel (search panel uses `zIndex: 20`; the overlay must stay below it).
- Tests: `cd frontend && npm test` (Vitest + jsdom). jsdom has no real layout, so tests target the pure ancestor-chain computation plus DOM assertions that do not depend on real scroll metrics — the plugin exposes `refreshSticky(view, topPos)` so tests can force a top line instead of scrolling.
- Match existing code style (2-space indent, single quotes, `// lowercase comments` explaining why). Run `cd frontend && npm run format` before each commit.

---

### Task 1: `computeStickyLines` — pure ancestor-chain computation

**Files:**
- Create: `frontend/src/lib/editor/stickyPath.ts`
- Test: `frontend/src/tests/response/stickyPath.test.ts`

**Interfaces:**
- Consumes: `syntaxTree`/`ensureSyntaxTree`/`foldedRanges` from `@codemirror/language`.
- Produces: `interface StickyLine { from: number; text: string }` and `function computeStickyLines(state: EditorState, topPos: number): StickyLine[]` — Task 2's plugin calls this on every refresh; `from` is the start of the anchor line, `text` its full text, ordered outermost → innermost, max 5 entries.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/tests/response/stickyPath.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { codeFolding, foldEffect } from '@codemirror/language';
import { computeStickyLines } from '../../lib/editor/stickyPath';

// line numbers:            1    2            3               4             5         6      7      8    9   10
const nested = ['{', '  "user": {', '    "profile": {', '      "tags": [', '        "a",', '        "b"', '      ]', '    }', '  }', '}'].join('\n');

function stateOf(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [json(), codeFolding()] });
}

function texts(state: EditorState, lineNumber: number): string[] {
  return computeStickyLines(state, state.doc.line(lineNumber).from).map((l) => l.text);
}

describe('computeStickyLines', () => {
  it('returns the enclosing property lines, outermost first', () => {
    const state = stateOf(nested);
    // top visible line is `"a",` (line 5)
    expect(texts(state, 5)).toEqual(['  "user": {', '    "profile": {', '      "tags": [']);
  });

  it('shortens the chain as the top line moves out of inner containers', () => {
    const state = stateOf(nested);
    // top visible line is `}` closing profile (line 8): only user encloses it
    expect(texts(state, 8)).toEqual(['  "user": {']);
  });

  it('returns nothing at the top of the document', () => {
    const state = stateOf(nested);
    expect(texts(state, 1)).toEqual([]);
  });

  it('returns nothing for a flat document (depth 0 content)', () => {
    const state = stateOf('{\n  "a": 1,\n  "b": 2\n}');
    expect(texts(state, 3)).toEqual([]);
  });

  it('keeps the deepest 5 levels when nested deeper', () => {
    // 7 nested objects: l1 … l7, then a value line
    let doc = '{\n';
    for (let i = 1; i <= 7; i++) doc += `${'  '.repeat(i)}"l${i}": {\n`;
    doc += `${'  '.repeat(8)}"x": 1\n`;
    for (let i = 7; i >= 1; i--) doc += `${'  '.repeat(i)}}\n`;
    doc += '}';
    const state = stateOf(doc);
    // top visible line is `"x": 1` (line 9); l1 and l2 fall off the cap
    expect(texts(state, 9)).toEqual([
      '      "l3": {',
      '        "l4": {',
      '          "l5": {',
      '            "l6": {',
      '              "l7": {',
    ]);
  });

  it('maps an anchor inside a folded region to the fold header line', () => {
    const base = stateOf(nested);
    // fold from end of line 2 through end of line 4: the profile and tags
    // property lines are hidden inside the fold, line 2 is the header
    const state = base.update({
      effects: foldEffect.of({ from: base.doc.line(2).to, to: base.doc.line(4).to }),
    }).state;
    expect(texts(state, 5)).toEqual(['  "user": {']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- src/tests/response/stickyPath.test.ts`
Expected: FAIL — `Failed to resolve import "../../lib/editor/stickyPath"` (module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/editor/stickyPath.ts`:

```ts
// Sticky JSON context: while scrolling a nested JSON document, the enclosing
// object/array property lines stay pinned at the top of the editor
// (VS Code-style sticky scroll). Pure computation lives in
// computeStickyLines; the overlay rendering is added in the stickyPath()
// extension below.

import { EditorState } from '@codemirror/state';
import { syntaxTree, ensureSyntaxTree, foldedRanges } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';

const MAX_LEVELS = 5;

export interface StickyLine {
  from: number; // start of the anchor line in the document
  text: string; // full text of the anchor line
}

// Walk up the syntax tree from the top visible line and collect the anchor
// line of every enclosing Object/Array: the line naming it (its Property)
// when it is a property value, otherwise its opening-bracket line.
export function computeStickyLines(state: EditorState, topPos: number): StickyLine[] {
  const doc = state.doc;
  const topLine = doc.lineAt(topPos);
  // the tree is parsed lazily; make sure it covers the top line (cheap: the
  // viewport is normally already parsed by the language extension)
  const tree = ensureSyntaxTree(state, topLine.to, 100) ?? syntaxTree(state);
  const anchors: number[] = [];
  for (let n: SyntaxNode | null = tree.resolveInner(topLine.from, 1); n; n = n.parent) {
    if (n.name !== 'Object' && n.name !== 'Array') continue;
    // the root container is depth 0 — never pinned (flat docs show nothing)
    if (!n.parent || n.parent.name === 'JsonText') continue;
    let anchor = n.parent.name === 'Property' ? n.parent.from : n.from;
    // an anchor hidden inside a folded region shows as its fold header line
    foldedRanges(state).between(0, anchor, (from, to) => {
      if (anchor > from && anchor <= to) anchor = from;
    });
    anchors.push(anchor);
  }
  anchors.reverse(); // outermost first, like the real document
  const lines: StickyLine[] = [];
  let prev = 0;
  for (const a of anchors) {
    const line = doc.lineAt(a);
    // dedupe fold-collapsed anchors and drop anything at/below the top line
    if (line.number <= prev || line.number >= topLine.number) continue;
    prev = line.number;
    lines.push({ from: line.from, text: line.text });
  }
  return lines.slice(-MAX_LEVELS); // deeper than 5 levels: keep the deepest 5
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- src/tests/response/stickyPath.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Run the full suite, format, commit**

Run: `cd frontend && npm test && npm run format`
Expected: all existing tests still pass.

```bash
git add frontend/src/lib/editor/stickyPath.ts frontend/src/tests/response/stickyPath.test.ts
git commit -m "feat: sticky JSON context ancestor-chain computation"
```

---

### Task 2: Overlay ViewPlugin — rendering, click-to-jump, theme

**Files:**
- Modify: `frontend/src/lib/editor/stickyPath.ts` (append to Task 1's file)
- Test: `frontend/src/tests/response/stickyPath.dom.test.ts`

**Interfaces:**
- Consumes: `computeStickyLines(state, topPos): StickyLine[]` and `StickyLine` from Task 1; `jsonHighlightStyle` from `frontend/src/lib/editor/jsonHighlight.ts`.
- Produces: `function stickyPath(): Extension` (the plugin + theme, what Task 3 wires into the components) and `function refreshSticky(view: EditorView, topPos: number): void` (test hook: recompute the overlay as if the line at `topPos` were the first fully visible line). Overlay DOM: `div.cm-sticky-path` appended to `view.dom`, containing one `div.cm-sticky-line` per ancestor with `data-from` set to the anchor line start.

- [ ] **Step 1: Write the failing DOM tests**

Create `frontend/src/tests/response/stickyPath.dom.test.ts` (conventions follow `searchpanel.dom.test.ts`; jsdom has no layout, so `refreshSticky` forces the top line instead of scrolling):

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { codeFolding, syntaxHighlighting } from '@codemirror/language';
import { jsonHighlightStyle } from '../../lib/editor/jsonHighlight';
import { stickyPath, refreshSticky } from '../../lib/editor/stickyPath';

const nested = ['{', '  "user": {', '    "profile": {', '      "tags": [', '        "a",', '        "b"', '      ]', '    }', '  }', '}'].join('\n');

function makeView(doc: string): { view: EditorView; host: HTMLElement } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc,
      extensions: [json(), codeFolding(), syntaxHighlighting(jsonHighlightStyle), stickyPath()],
    }),
  });
  return { view, host };
}

describe('sticky path overlay', () => {
  it('renders the ancestor chain as sticky lines', () => {
    const { view, host } = makeView(nested);
    refreshSticky(view, view.state.doc.line(5).from);
    const lines = [...host.querySelectorAll<HTMLElement>('.cm-sticky-line')];
    expect(lines.map((l) => l.textContent)).toEqual(['  "user": {', '    "profile": {', '      "tags": [']);
    view.destroy();
  });

  it('syntax-highlights the copies through the editor highlight style', () => {
    const { view, host } = makeView(nested);
    refreshSticky(view, view.state.doc.line(5).from);
    // property names get a highlight class span, same as real lines
    const spans = host.querySelectorAll('.cm-sticky-line span[class]');
    expect(spans.length).toBeGreaterThan(0);
    view.destroy();
  });

  it('hides the overlay at depth 0', () => {
    const { view, host } = makeView(nested);
    refreshSticky(view, view.state.doc.line(5).from);
    refreshSticky(view, 0);
    const overlay = host.querySelector<HTMLElement>('.cm-sticky-path')!;
    expect(overlay.style.display).toBe('none');
    view.destroy();
  });

  it('clicking a sticky line moves the cursor to that line', () => {
    const { view, host } = makeView(nested);
    refreshSticky(view, view.state.doc.line(5).from);
    const target = [...host.querySelectorAll<HTMLElement>('.cm-sticky-line')].find((l) => l.textContent === '    "profile": {')!;
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(view.state.selection.main.head).toBe(view.state.doc.line(3).from);
    view.destroy();
  });

  it('recomputes on document changes', () => {
    const { view, host } = makeView(nested);
    refreshSticky(view, view.state.doc.line(5).from);
    // replacing the whole doc with a flat one empties the chain
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '{\n  "a": 1\n}' } });
    const overlay = host.querySelector<HTMLElement>('.cm-sticky-path')!;
    expect(overlay.style.display).toBe('none');
    view.destroy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- src/tests/response/stickyPath.dom.test.ts`
Expected: FAIL — `stickyPath`/`refreshSticky` are not exported.

- [ ] **Step 3: Write the implementation**

Append to `frontend/src/lib/editor/stickyPath.ts` (and extend the imports at the top of the file to match):

```ts
import { EditorState, EditorSelection, type Extension } from '@codemirror/state';
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { syntaxTree, ensureSyntaxTree, foldedRanges } from '@codemirror/language';
import { highlightTree } from '@lezer/highlight';
import type { SyntaxNode } from '@lezer/common';
import { jsonHighlightStyle } from './jsonHighlight';
```

New code below `computeStickyLines`:

```ts
// stays under the floating search panel (zIndex 20 in CodeViewer's theme)
const stickyTheme = EditorView.theme({
  '.cm-sticky-path': {
    position: 'absolute',
    top: '0',
    left: '0',
    right: '0',
    zIndex: '10',
    backgroundColor: 'var(--bg)',
    borderBottom: '1px solid var(--border)',
    overflow: 'hidden',
  },
  '.cm-sticky-line': {
    whiteSpace: 'pre',
    cursor: 'pointer',
    color: 'var(--text-soft)',
  },
  '.cm-sticky-line:hover': { backgroundColor: 'var(--bg-hover)' },
});

const stickyPlugin = ViewPlugin.fromClass(
  class {
    overlay: HTMLElement;
    lines: StickyLine[] = [];
    private key = '';

    constructor(readonly view: EditorView) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'cm-sticky-path';
      this.overlay.style.display = 'none';
      this.overlay.addEventListener('mousedown', this.onClick);
      view.scrollDOM.addEventListener('scroll', this.onScroll);
      view.dom.appendChild(this.overlay);
      this.refresh();
    }

    update(u: ViewUpdate) {
      // fold changes arrive as viewport/geometry changes
      if (u.docChanged || u.viewportChanged || u.geometryChanged) this.refresh();
    }

    onScroll = () => this.refresh();

    onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.cm-sticky-line');
      if (!el) return;
      e.preventDefault();
      const from = Number(el.dataset.from);
      this.view.dispatch({
        selection: EditorSelection.cursor(from),
        effects: EditorView.scrollIntoView(from, { y: 'start' }),
      });
      this.view.focus();
    };

    // first line fully visible below the overlay (block heights are
    // document-relative, same space as scrollTop)
    topVisiblePos(): number {
      const offset = this.view.scrollDOM.scrollTop + this.lines.length * this.view.defaultLineHeight;
      let block = this.view.lineBlockAtHeight(offset);
      if (block.top < offset && block.to + 1 <= this.view.state.doc.length) {
        block = this.view.lineBlockAt(block.to + 1);
      }
      return block.from;
    }

    refresh(topPos = this.topVisiblePos()) {
      const lines = computeStickyLines(this.view.state, topPos);
      const key = lines.map((l) => `${l.from}:${l.text}`).join('\n');
      if (key === this.key) return;
      this.key = key;
      this.lines = lines;
      this.overlay.replaceChildren(...lines.map((l) => this.renderLine(l)));
      this.overlay.style.display = lines.length ? '' : 'none';
      // start the copies where real line text starts (right of the gutter)
      this.overlay.style.paddingLeft = `${this.view.contentDOM.offsetLeft}px`;
    }

    // re-render the line's text through the editor's highlight style so the
    // copy is visually identical to the real line, not a plain-text clone
    renderLine(l: StickyLine): HTMLElement {
      const el = document.createElement('div');
      el.className = 'cm-sticky-line';
      el.dataset.from = String(l.from);
      el.style.height = `${this.view.defaultLineHeight}px`;
      const state = this.view.state;
      const to = l.from + l.text.length;
      let pos = l.from;
      highlightTree(
        syntaxTree(state),
        jsonHighlightStyle,
        (from, spanTo, classes) => {
          if (from > pos) el.appendChild(document.createTextNode(state.sliceDoc(pos, from)));
          const span = document.createElement('span');
          span.className = classes;
          span.textContent = state.sliceDoc(from, spanTo);
          el.appendChild(span);
          pos = spanTo;
        },
        l.from,
        to,
      );
      if (pos < to) el.appendChild(document.createTextNode(state.sliceDoc(pos, to)));
      return el;
    }

    destroy() {
      this.view.scrollDOM.removeEventListener('scroll', this.onScroll);
      this.overlay.remove();
    }
  },
);

// the extension components wire in for JSON mode
export function stickyPath(): Extension {
  return [stickyPlugin, stickyTheme];
}

// test hook: force a top visible line without real scroll metrics (jsdom)
export function refreshSticky(view: EditorView, topPos: number) {
  view.plugin(stickyPlugin)?.refresh(topPos);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- src/tests/response/stickyPath.dom.test.ts src/tests/response/stickyPath.test.ts`
Expected: PASS (11 tests total).

- [ ] **Step 5: Run the full suite, format, commit**

Run: `cd frontend && npm test && npm run format`
Expected: all tests pass.

```bash
git add frontend/src/lib/editor/stickyPath.ts frontend/src/tests/response/stickyPath.dom.test.ts
git commit -m "feat: sticky JSON context overlay plugin with click-to-jump"
```

---

### Task 3: Wire into CodeViewer and CodeEditor (JSON mode only)

**Files:**
- Modify: `frontend/src/lib/editor/CodeViewer.svelte:177-194` (the `extensions()` function)
- Modify: `frontend/src/lib/editor/CodeEditor.svelte:83-109` (the `extensions()` function)
- Test: `frontend/src/tests/response/stickyPath.dom.test.ts` (append a describe block)

**Interfaces:**
- Consumes: `stickyPath(): Extension` and `refreshSticky(view, topPos)` from Task 2.
- Produces: sticky context active in the JSON response viewer and the JSON request-body editor; inactive in text mode, single-line editors, and (by construction — `CodeViewer` is only mounted for json/raw modes) image mode.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/tests/response/stickyPath.dom.test.ts` (extend the imports at the top with the two components and Svelte's `mount`/`unmount`, mirroring `searchpanel.dom.test.ts`):

```ts
import { mount, unmount } from 'svelte';
import CodeViewer from '../../lib/editor/CodeViewer.svelte';
import CodeEditor from '../../lib/editor/CodeEditor.svelte';

describe('sticky path integration', () => {
  it('is active in the JSON response viewer', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const comp = mount(CodeViewer, { target: host, props: { value: nested, lang: 'json' } });
    await Promise.resolve();
    const view = EditorView.findFromDOM(host.querySelector('.cm-editor') as HTMLElement)!;
    refreshSticky(view, view.state.doc.line(5).from);
    expect(host.querySelectorAll('.cm-sticky-line').length).toBe(3);
    unmount(comp);
  });

  it('is inactive in text mode', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const comp = mount(CodeViewer, { target: host, props: { value: nested, lang: 'text' } });
    await Promise.resolve();
    expect(host.querySelector('.cm-sticky-path')).toBeNull();
    unmount(comp);
  });

  it('is active in the JSON body editor', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const comp = mount(CodeEditor, {
      target: host,
      props: { value: nested, lang: 'json', onChange: () => {} },
    });
    await Promise.resolve();
    const view = EditorView.findFromDOM(host.querySelector('.cm-editor') as HTMLElement)!;
    refreshSticky(view, view.state.doc.line(5).from);
    expect(host.querySelectorAll('.cm-sticky-line').length).toBe(3);
    unmount(comp);
  });

  it('is inactive in the text body editor', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const comp = mount(CodeEditor, {
      target: host,
      props: { value: 'plain text', lang: 'text', onChange: () => {} },
    });
    await Promise.resolve();
    expect(host.querySelector('.cm-sticky-path')).toBeNull();
    unmount(comp);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- src/tests/response/stickyPath.dom.test.ts`
Expected: FAIL — the four integration tests fail (no `.cm-sticky-path` in components; `refreshSticky` is a no-op because the plugin isn't installed, so 0 sticky lines).

- [ ] **Step 3: Add the extension to both components**

In `frontend/src/lib/editor/CodeViewer.svelte`, add the import next to the other editor imports:

```ts
import { stickyPath } from './stickyPath';
```

and change the last line of `extensions()` from:

```ts
    if (lang === 'json') ext.push(json());
```

to:

```ts
    if (lang === 'json') ext.push(json(), stickyPath());
```

In `frontend/src/lib/editor/CodeEditor.svelte`, add the import next to the other editor imports:

```ts
import { stickyPath } from './stickyPath';
```

and change the JSON branch of `extensions()` from:

```ts
      if (lang === 'json') {
        ext.push(json(), syntaxHighlighting(jsonHighlightStyle), lintGutter(), linter(jsonSyntaxErrors));
      }
```

to:

```ts
      if (lang === 'json') {
        ext.push(json(), syntaxHighlighting(jsonHighlightStyle), lintGutter(), linter(jsonSyntaxErrors), stickyPath());
      }
```

(The `singleLine` branch never reaches this code, so single-line editors stay clean; `CodeViewer` in raw mode passes `lang: 'text'` and image responses never mount `CodeViewer`, so those modes are unaffected.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- src/tests/response/stickyPath.dom.test.ts`
Expected: PASS (9 tests in the file).

- [ ] **Step 5: Run the full suite (including the existing search panel test), format**

Run: `cd frontend && npm test && npm run check && npm run format`
Expected: all tests pass — `searchpanel.dom.test.ts` in particular, proving the overlay coexists with the search panel; `svelte-check` clean.

- [ ] **Step 6: Manual pixel check (jsdom cannot verify layout)**

Run the app, open a request with a large nested JSON response, and verify in JSON mode: chain appears/updates while scrolling, matches real line font/size/highlighting, aligns with the gutter, deepest-5 cap, hidden at top, click jumps and places the cursor, fold gutter and ⌘F search panel still work above/next to the overlay, raw and image modes show no overlay. Fix any spacing issues inside `stickyTheme`/`refresh` only (CSS vars, `paddingLeft`).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/editor/CodeViewer.svelte frontend/src/lib/editor/CodeEditor.svelte frontend/src/tests/response/stickyPath.dom.test.ts
git commit -m "feat: enable sticky JSON context in response viewer and body editor"
```
