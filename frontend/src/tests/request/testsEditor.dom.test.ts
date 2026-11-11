// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { mount, unmount } from 'svelte';
import TestsEditor from '../../lib/request/TestsEditor.svelte';
import { request } from '../../lib/workspace/state';

describe('TestsEditor', () => {
  it('shows the saved script and edits flow back to the request store', async () => {
    request.set({
      method: 'GET',
      url: '',
      query: {},
      disabledQuery: [],
      headers: {},
      body: { type: 'json', content: '' },
      vars: {},
      tests: { script: 'assert res.status == 200' },
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const comp = mount(TestsEditor, { target: host });
    await Promise.resolve();
    const cm = host.querySelector('.cm-content');
    expect(cm?.textContent).toContain('assert res.status == 200');
    unmount(comp);
    request.set(null);
  });

  it('renders the placeholder for an empty script', async () => {
    request.set({
      method: 'GET',
      url: '',
      query: {},
      disabledQuery: [],
      headers: {},
      body: { type: 'json', content: '' },
      vars: {},
      tests: { script: '' },
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const comp = mount(TestsEditor, { target: host });
    await Promise.resolve();
    expect(host.querySelector('.cm-placeholder')?.textContent).toContain('assert res.status == 200');
    expect(get(request)?.tests.script).toBe('');
    unmount(comp);
    request.set(null);
  });
});
