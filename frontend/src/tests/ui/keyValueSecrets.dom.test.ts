// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import KeyValueEditor from '../../lib/ui/KeyValueEditor.svelte';

describe('KeyValueEditor secrets', () => {
  it('masks secret values, reveals on toggle, and reports secret toggles', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const toggled: string[] = [];
    const comp = mount(KeyValueEditor, {
      target: host,
      props: {
        entries: { api_url: 'https://x', api_token: 'sk-abc' },
        onChange: () => {},
        secretKeys: ['api_token'],
        onToggleSecret: (key: string) => toggled.push(key),
      },
    });
    await Promise.resolve();

    const valueInputs = [...host.querySelectorAll<HTMLInputElement>('td input[placeholder="value"]')];
    const tokenInput = valueInputs.find((i) => i.value === 'sk-abc')!;
    expect(tokenInput.type).toBe('password');
    const urlInput = valueInputs.find((i) => i.value === 'https://x')!;
    expect(urlInput.type).toBe('text');

    // secret marker on the secret row only
    expect(host.querySelectorAll('button.secret-toggle.is-secret')).toHaveLength(1);

    // reveal — the branch swap renders a new input node, so re-query
    host.querySelector<HTMLButtonElement>('button.reveal')!.click();
    flushSync();
    const revealedInput = [...host.querySelectorAll<HTMLInputElement>('td input[placeholder="value"]')].find(
      (i) => i.value === 'sk-abc',
    )!;
    expect(revealedInput.type).toBe('text');

    // toggle secret <-> normal reports the key
    host.querySelector<HTMLButtonElement>('button.secret-toggle.is-secret')!.click();
    await Promise.resolve();
    expect(toggled).toEqual(['api_token']);

    unmount(comp);
  });
});
