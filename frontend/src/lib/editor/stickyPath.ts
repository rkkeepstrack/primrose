// Sticky JSON context: while scrolling a nested JSON document, the enclosing
// object/array property lines stay pinned at the top of the editor
// (VS Code-style sticky scroll). Pure computation lives in
// computeStickyLines; the overlay rendering is added in the stickyPath()
// extension below.

import { EditorState, EditorSelection, type Extension } from '@codemirror/state';
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { syntaxTree, ensureSyntaxTree, foldedRanges } from '@codemirror/language';
import { highlightTree } from '@lezer/highlight';
import type { SyntaxNode } from '@lezer/common';
import { jsonHighlightStyle } from './jsonHighlight';

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
  // viewport is normally already parsed by the language extension).
  // NOTE(partial-parse): on very large documents ensureSyntaxTree may return
  // null (timeout 100 ms) and we fall back to whatever the incremental parser
  // has so far — ancestors above the parsed region are silently omitted.
  const tree = ensureSyntaxTree(state, topLine.to, 100) ?? syntaxTree(state);
  const anchors: number[] = [];
  for (let n: SyntaxNode | null = tree.resolveInner(topLine.from, 1); n; n = n.parent) {
    if (n.name !== 'Object' && n.name !== 'Array') continue;
    // the root container is depth 0 — never pinned (flat docs show nothing)
    if (!n.parent || n.parent.name === 'JsonText') continue;
    // skip containers whose closing bracket is on the top line (we're AT the closing brace)
    if (doc.lineAt(n.to).number === topLine.number) continue;
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
    private lastTopPos = 0;
    private contentLeft = 0;

    constructor(readonly view: EditorView) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'cm-sticky-path';
      this.overlay.style.display = 'none';
      this.overlay.addEventListener('mousedown', this.onClick);
      view.scrollDOM.addEventListener('scroll', this.onScroll);
      view.dom.appendChild(this.overlay);
      view.requestMeasure(this.measureGutter);
    }

    update(u: ViewUpdate) {
      // fold changes arrive as viewport/geometry changes; use last known topPos
      // because layout reads are not allowed during an update call
      if (u.docChanged || u.viewportChanged || u.geometryChanged) {
        // keep the tracked position pointing at the same text after edits
        if (u.docChanged) this.lastTopPos = u.changes.mapPos(this.lastTopPos);
        this.refresh(this.lastTopPos);
        // layout reads (gutter offset) must happen outside the update cycle
        this.view.requestMeasure(this.measureGutter);
      }
    }

    // read the gutter offset in a measure phase, then apply it to the overlay
    measureGutter = {
      read: () => this.view.contentDOM.offsetLeft,
      write: (left: number) => {
        this.contentLeft = left;
        this.overlay.style.paddingLeft = `${left}px`;
      },
    };

    onScroll = () => {
      this.lastTopPos = this.topVisiblePos();
      this.contentLeft = this.view.contentDOM.offsetLeft;
      this.refresh(this.lastTopPos);
    };

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

    refresh(topPos = this.lastTopPos) {
      this.lastTopPos = topPos; // keep doc-change remapping anchored to the last shown position
      const lines = computeStickyLines(this.view.state, topPos);
      const key = lines.map((l) => `${l.from}:${l.text}`).join('\n');
      if (key === this.key) return;
      this.key = key;
      this.lines = lines;
      this.overlay.replaceChildren(...lines.map((l) => this.renderLine(l)));
      this.overlay.style.display = lines.length ? '' : 'none';
      // start the copies where real line text starts (right of the gutter);
      // cached value — offsetLeft is a layout read, not allowed during update()
      this.overlay.style.paddingLeft = `${this.contentLeft}px`;
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
