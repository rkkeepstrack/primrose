import { ensureSyntaxTree, foldEffect, syntaxTree } from '@codemirror/language';
import type { EditorView } from '@codemirror/view';
import type { StateEffect } from '@codemirror/state';

// "Collapse all" for a JSON document: fold every object and array except
// the root, so the top-level keys stay readable and each level you open
// shows its children collapsed in turn (DevTools style). foldAll would
// hide everything behind one {…}.
export function foldBelowRoot(view: EditorView) {
  const { state } = view;
  // the incremental parser only covers the viewport; without a full tree the
  // tail of a big body simply doesn't get folded
  const tree = ensureSyntaxTree(state, state.doc.length, 5000) ?? syntaxTree(state);
  const root = tree.topNode.firstChild;
  if (!root) return;
  const effects: StateEffect<unknown>[] = [];
  tree.iterate({
    enter: (node) => {
      if (node.from === root.from && node.to === root.to) return;
      if (node.name !== 'Object' && node.name !== 'Array') return;
      // same range the fold gutter uses: everything between the brackets
      const from = node.from + 1;
      const to = node.to - 1;
      if (to > from) effects.push(foldEffect.of({ from, to }));
    },
  });
  if (effects.length) view.dispatch({ effects });
}
