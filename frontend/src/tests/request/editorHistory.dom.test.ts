// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { mount, unmount } from 'svelte';
import { tick } from 'svelte';
import { EditorView } from '@codemirror/view';
import { undo } from '@codemirror/commands';
import TestsEditor from '../../lib/request/TestsEditor.svelte';
import { dirty, request, selectedPath } from '../../lib/workspace/state';
import type { ApiRequest } from '../../lib/shared/types';

function req(script: string): ApiRequest {
  return {
    method: 'GET',
    url: '',
    query: {},
    disabledQuery: [],
    headers: {},
    body: { type: 'json', content: '' },
    vars: {},
    tests: { script },
  };
}

describe('CodeEditor history across external value writes', () => {
  it('keeps undo history when the same request is written from outside', async () => {
    selectedPath.set('/c/a.toml');
    request.set(req('one'));
    dirty.set(false);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const comp = mount(TestsEditor, { target: host });
    await tick();
    const view = EditorView.findFromDOM(host.querySelector('.cm-editor') as HTMLElement)!;

    request.update((r) => ({ ...r!, tests: { script: 'two' } }));
    await tick();
    expect(view.state.doc.toString()).toBe('two');
    expect(get(dirty)).toBe(false); // an external write is not an edit

    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('one');
    expect(get(request)?.tests.script).toBe('one');

    unmount(comp);
    request.set(null);
    selectedPath.set(null);
  });

  it('starts a fresh history when another request is opened', async () => {
    selectedPath.set('/c/a.toml');
    request.set(req('one'));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const comp = mount(TestsEditor, { target: host });
    await tick();

    selectedPath.set('/c/b.toml');
    request.set(req('other'));
    await tick();
    const view = EditorView.findFromDOM(host.querySelector('.cm-editor') as HTMLElement)!;
    expect(view.state.doc.toString()).toBe('other');
    expect(undo(view)).toBe(false);

    unmount(comp);
    request.set(null);
    selectedPath.set(null);
  });
});
