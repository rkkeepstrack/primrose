// Editor-style diagnostics: the Lezer JSON parser is error-tolerant and
// marks every broken node, so each error attaches to its own line instead
// of only reporting the first JSON.parse failure.

import type { EditorView } from '@codemirror/view';
import type { Diagnostic } from '@codemirror/lint';
import { syntaxTree } from '@codemirror/language';

export function jsonSyntaxErrors(view: EditorView): Diagnostic[] {
  if (view.state.doc.toString().trim() === '') return []; // empty body is fine
  const diagnostics: Diagnostic[] = [];
  syntaxTree(view.state)
    .cursor()
    .iterate((node) => {
      if (!node.type.isError) return;
      diagnostics.push({
        from: node.from,
        to: Math.max(node.to, Math.min(node.from + 1, view.state.doc.length)),
        severity: 'error',
        message: 'Invalid JSON syntax',
      });
    });
  return diagnostics;
}
