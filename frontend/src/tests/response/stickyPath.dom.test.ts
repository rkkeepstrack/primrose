// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { codeFolding, syntaxHighlighting } from '@codemirror/language';
import { jsonHighlightStyle } from '../../lib/editor/jsonHighlight';
import { stickyPath, refreshSticky } from '../../lib/editor/stickyPath';

const nested = [
  '{',
  '  "user": {',
  '    "profile": {',
  '      "tags": [',
  '        "a",',
  '        "b"',
  '      ]',
  '    }',
  '  }',
  '}',
].join('\n');

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
