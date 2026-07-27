// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { openSearchPanel, search } from '@codemirror/search';
import CodeViewer from '../../lib/editor/CodeViewer.svelte';

describe('response search panel', () => {
  it('opens the custom panel and counts matches', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const comp = mount(CodeViewer, {
      target: host,
      props: { value: 'alpha beta alpha\nalpha', lang: 'text' },
    });
    await Promise.resolve();
    const cm = host.querySelector('.cm-editor');
    expect(cm).toBeTruthy();
    const view = EditorView.findFromDOM(cm as HTMLElement)!;
    expect(view).toBeTruthy();

    openSearchPanel(view);
    const input = host.querySelector<HTMLInputElement>('.search input');
    expect(input, 'panel input should exist').toBeTruthy();

    input!.value = 'alpha';
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
    const count = host.querySelector('.count');
    expect(count?.textContent).toContain('/3');

    unmount(comp);
  });
});
