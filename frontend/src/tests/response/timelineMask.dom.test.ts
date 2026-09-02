// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import Timeline from '../../lib/response/Timeline.svelte';
import StatusLine from '../../lib/response/StatusLine.svelte';
import { maskSecrets } from '../../lib/shared/secrets';
import type { RunRecord } from '../../lib/shared/types';

describe('Timeline secret masking', () => {
  it('renders URLs and redirects through the mask', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const runs = [
      {
        at: new Date(),
        error: null,
        response: {
          status: 200,
          durationMs: 12,
          requestUrl: 'https://api.example/items?key=sk-abc123',
          finalUrl: 'https://api.example/items?key=sk-abc123',
          redirects: ['https://api.example/v2?key=sk-abc123'],
          headers: {},
        },
      },
    ] as unknown as RunRecord[];
    const comp = mount(Timeline, {
      target: host,
      props: {
        runs,
        viewedIdx: 0,
        onView: () => {},
        mask: (s: string) => maskSecrets(s, { api_token: 'sk-abc123' }),
      },
    });
    await Promise.resolve();

    expect(host.textContent).not.toContain('sk-abc123');
    expect(host.textContent).toContain('{{api_token}}');
    // both the main URL and the redirect hop are masked
    expect(host.querySelectorAll('.row-url').length).toBe(2);

    unmount(comp);
  });
});

describe('StatusLine secret masking', () => {
  const secretRun = (redirects: string[]) =>
    ({
      at: new Date(),
      error: null,
      response: {
        status: 200,
        statusText: 'OK',
        durationMs: 12,
        size: 10,
        requestUrl: 'https://api.example/items?key=sk-abc123',
        finalUrl: 'https://api.example/v2?key=sk-abc123',
        redirects,
        headers: {},
      },
    }) as unknown as RunRecord;

  it('renders the sent URL through the mask', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const comp = mount(StatusLine, {
      target: host,
      props: {
        run: secretRun([]),
        mask: (s: string) => maskSecrets(s, { api_token: 'sk-abc123' }),
      },
    });
    await Promise.resolve();

    expect(host.textContent).not.toContain('sk-abc123');
    expect(host.textContent).toContain('{{api_token}}');

    unmount(comp);
  });

  it('renders the redirect chain through the mask', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const comp = mount(StatusLine, {
      target: host,
      props: {
        run: secretRun(['https://api.example/v2?key=sk-abc123']),
        mask: (s: string) => maskSecrets(s, { api_token: 'sk-abc123' }),
      },
    });
    await Promise.resolve();

    expect(host.textContent).not.toContain('sk-abc123');
    expect(host.textContent).toContain('{{api_token}}');

    unmount(comp);
  });
});
