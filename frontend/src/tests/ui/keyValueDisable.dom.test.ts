// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import KeyValueEditor from '../../lib/ui/KeyValueEditor.svelte';

describe('KeyValueEditor enable toggles', () => {
  it('shows a power button per row, marked off for disabled keys, and reports toggles', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const toggled: [string, boolean][] = [];
    const comp = mount(KeyValueEditor, {
      target: host,
      props: {
        entries: { a: '1', debug: 'true' },
        onChange: () => {},
        disabledKeys: ['debug'],
        onToggleEnabled: (key: string, enabled: boolean) => toggled.push([key, enabled]),
      },
    });
    await Promise.resolve();

    const boxes = [...host.querySelectorAll<HTMLButtonElement>('button.enable-toggle')];
    expect(boxes.map((b) => b.classList.contains('is-off'))).toEqual([false, true]);
    expect(host.querySelectorAll('tr.off')).toHaveLength(1);

    boxes[1].click();
    await Promise.resolve();
    expect(toggled).toEqual([['debug', true]]);

    unmount(comp);
  });

  it('renders no power buttons without onToggleEnabled', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const comp = mount(KeyValueEditor, { target: host, props: { entries: { a: '1' }, onChange: () => {} } });
    await Promise.resolve();
    expect(host.querySelectorAll('button.enable-toggle')).toHaveLength(0);
    unmount(comp);
  });
});
