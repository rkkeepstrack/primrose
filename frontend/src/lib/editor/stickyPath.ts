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
