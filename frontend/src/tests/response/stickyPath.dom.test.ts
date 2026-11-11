// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { codeFolding, syntaxHighlighting } from '@codemirror/language';
import { jsonHighlightStyle } from '../../lib/editor/jsonHighlight';
import { stickyPath, refreshSticky } from '../../lib/editor/stickyPath';
import { mount, unmount } from 'svelte';
import CodeViewer from '../../lib/editor/CodeViewer.svelte';
import CodeEditor from '../../lib/editor/CodeEditor.svelte';

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

  it('clicking a sticky line scrolls it below the rows that stay pinned above it', () => {
    const { view, host } = makeView(nested);
    refreshSticky(view, view.state.doc.line(5).from);
    const seen: { pos: number; yMargin: number }[] = [];
    const dispatch = view.dispatch.bind(view);
    view.dispatch = ((spec: Parameters<typeof dispatch>[0]) => {
      const tr = view.state.update(spec as never);
      for (const e of tr.effects) {
        const v = e.value as { range?: { from: number }; yMargin?: number };
        if (v.range && typeof v.yMargin === 'number') seen.push({ pos: v.range.from, yMargin: v.yMargin });
      }
      dispatch(tr);
    }) as typeof view.dispatch;
    // "profile" is the second row: "user" stays pinned above it, one line's worth
    const target = [...host.querySelectorAll<HTMLElement>('.cm-sticky-line')].find((l) => l.textContent === '    "profile": {')!;
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(seen).toEqual([{ pos: view.state.doc.line(3).from, yMargin: view.defaultLineHeight }]);
    view.destroy();
  });

  it('remaps the tracked position when text is inserted above the sticky region', () => {
    const { view, host } = makeView(nested);
    refreshSticky(view, view.state.doc.line(5).from);
    // insert a new property line right after the opening brace, above everything sticky
    view.dispatch({ changes: { from: view.state.doc.line(1).to, insert: '\n  "inserted": 0,' } });
    const lines = [...host.querySelectorAll<HTMLElement>('.cm-sticky-line')];
    expect(lines.map((l) => l.textContent)).toEqual(['  "user": {', '    "profile": {', '      "tags": [']);
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
