// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { codeFolding, foldedRanges, unfoldAll } from '@codemirror/language';
import { foldBelowRoot } from '../../lib/editor/foldBelowRoot';

const doc = ['{', '  "user": {', '    "tags": [', '      "a"', '    ]', '  },', '  "n": 1,', '  "list": [', '    1', '  ]', '}'].join('\n');

function ranges(view: EditorView): [number, number][] {
  const out: [number, number][] = [];
  const it = foldedRanges(view.state).iter();
  while (it.value) {
    out.push([view.state.doc.lineAt(it.from).number, view.state.doc.lineAt(it.to).number]);
    it.next();
  }
  return out;
}

describe('foldBelowRoot', () => {
  it('folds every object and array below the root, leaving top-level keys visible', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView({ parent: host, state: EditorState.create({ doc, extensions: [json(), codeFolding()] }) });
    foldBelowRoot(view);
    expect(ranges(view)).toEqual([
      [2, 6],
      [3, 5],
      [8, 10],
    ]);
    unfoldAll(view);
    expect(ranges(view)).toEqual([]);
    view.destroy();
  });

  it('folds the whole document, not just the part the viewport parser reached', () => {
    // ~1MB of nested objects: well past what the incremental parser covers on load
    const big =
      '{\n' + Array.from({ length: 4000 }, (_, i) => `  "k${i}": {"a": [1, 2, 3], "b": "${'x'.repeat(200)}"}`).join(',\n') + '\n}';
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView({ parent: host, state: EditorState.create({ doc: big, extensions: [json(), codeFolding()] }) });
    foldBelowRoot(view);
    const folded = ranges(view);
    // each key holds an object plus one nested array
    expect(folded).toHaveLength(8000);
    expect(folded[7999]).toEqual([4001, 4001]);
    view.destroy();
  });
});
