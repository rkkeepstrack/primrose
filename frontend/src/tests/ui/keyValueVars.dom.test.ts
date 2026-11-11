// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { EditorView } from '@codemirror/view';
import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { createEnvVarCompletions } from '../../lib/editor/variableHighlight';
import KeyValueEditor from '../../lib/ui/KeyValueEditor.svelte';

function setup(props: Record<string, unknown>) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const comp = mount(KeyValueEditor, { target: host, props: { onChange: () => {}, ...props } as never });
  return { host, comp };
}

describe('KeyValueEditor {{var}} value cells', () => {
  it('renders value cells as variable-aware editors and reports edits', async () => {
    const changes: Record<string, string>[] = [];
    const { host, comp } = setup({
      entries: { page: '{{p}}' },
      envVars: { p: '2' },
      onChange: (e: Record<string, string>) => changes.push(e),
    });
    await tick();
    const cm = host.querySelector('td.value-cell .cm-editor') as HTMLElement;
    expect(cm).not.toBeNull();
    expect(host.querySelector('.cm-primrose-var')?.textContent).toBe('{{p}}');

    const view = EditorView.findFromDOM(cm)!;
    view.dispatch({ changes: { from: view.state.doc.length, insert: 'x' } });
    await tick();
    expect(changes.at(-1)).toEqual({ page: '{{p}}x' });
    unmount(comp);
  });

  it('the shared completion source offers env var names after {{', () => {
    const complete = createEnvVarCompletions(() => ({ token: 't', base: 'b' }));
    const state = EditorState.create({ doc: 'a={{to' });
    const res = complete(new CompletionContext(state, state.doc.length, false)) as { from: number; options: { label: string }[] };
    expect(res.from).toBe(4);
    expect(res.options.map((o) => o.label)).toEqual(['token', 'base']);
    expect(complete(new CompletionContext(EditorState.create({ doc: 'plain' }), 5, false))).toBeNull();
  });

  it('keeps plain inputs without envVars and for secret values', async () => {
    const plain = setup({ entries: { a: '1' } });
    await tick();
    expect(plain.host.querySelector('.cm-editor')).toBeNull();
    unmount(plain.comp);

    const secret = setup({ entries: { key: 's' }, envVars: {}, secretKeys: ['key'] });
    await tick();
    expect(secret.host.querySelector('td.value-cell input[type=password]')).not.toBeNull();
    expect(secret.host.querySelector('td.value-cell .cm-editor')).toBeNull();
    unmount(secret.comp);
  });
});
