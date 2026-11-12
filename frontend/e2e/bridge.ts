import type { Page } from '@playwright/test';
import fixture from './fixture.json' with { type: 'json' };

type Fixture = typeof fixture;

export interface BridgeOptions {
  // false: start with no collection open (the welcome screen)
  collection?: boolean;
  theme?: 'default' | 'gruvbox-light' | 'pastel';
}

/**
 * Installs a fake Wails bridge (window.go + window.runtime) backed by the
 * fixture, before the app's scripts run. The generated bindings call these
 * globals, so the frontend cannot tell the difference. Writes succeed and are
 * forgotten; anything the fixture doesn't know rejects loudly.
 */
export async function installBridge(page: Page, opts: BridgeOptions = {}) {
  await page.addInitScript(
    ({ fx, opts }: { fx: Fixture; opts: BridgeOptions }) => {
      const listeners = new Map<string, ((...data: unknown[]) => void)[]>();
      const clone = <T>(v: T): T => structuredClone(v);
      const fail = (msg: string) => Promise.reject(msg);
      const open = opts.collection !== false;
      const requests = fx.requests as Record<string, unknown>;
      const responses = fx.responses as Record<string, unknown>;
      const ok = async () => {};

      const App: Record<string, (...args: never[]) => Promise<unknown>> = {
        LoadUIState: async () => ({
          openRoots: open ? [fx.root] : [],
          activeRoot: open ? fx.root : '',
          theme: opts.theme ?? 'default',
        }),
        SaveUIState: ok,
        SetTheme: ok,
        OpenCollection: async (root: string) => (root === fx.root ? clone(fx.collection) : fail(`not a collection: ${root}`)),
        OpenCollectionDialog: async () => clone(fx.collection),
        GetTree: async (root: string) => (root === fx.root ? clone(fx.collection) : fail(`not a collection: ${root}`)),
        ListEnvironments: async () => clone(fx.environments),
        LoadHistory: async () => Object.keys(requests),
        SaveHistory: ok,
        GetCookies: async () => [],
        ReadRequest: async (path: string) => (path in requests ? clone(requests[path]) : fail(`reading request: no fixture for ${path}`)),
        SaveRequest: ok,
        CreateRequest: async (dir: string, name: string) => `${dir}/${name}.toml`,
        SendRequest: async (r: { method: string; url: string }) => {
          const key = `${r.method.toUpperCase()} ${r.url.split('?')[0]}`;
          return key in responses ? clone(responses[key]) : fail(`no fixture response for ${key}`);
        },
        CancelRequest: ok,
        ChooseDirectory: async () => '', // the user cancelled the picker
      };
      // writes succeed and are forgotten
      for (const name of [
        'AddCookie',
        'ClearCookies',
        'CreateCollection',
        'CreateFolder',
        'DeleteCookie',
        'DeleteEnvironment',
        'DeleteItem',
        'DuplicateEnvironment',
        'DuplicateItem',
        'MoveItem',
        'RenameEnvironment',
        'RenameItem',
        'SaveEnvironment',
      ])
        App[name] = ok;
      // a binding nobody taught the bridge fails loudly instead of quietly
      // rendering an empty state into the baselines
      const go = new Proxy(App, { get: (t, name: string) => t[name] ?? (() => fail(`fake bridge has no ${name}`)) });
      (window as unknown as { go: unknown }).go = { main: { App: go } };
      (window as unknown as { runtime: unknown }).runtime = {
        EventsOnMultiple: (name: string, cb: (...data: unknown[]) => void) => {
          listeners.set(name, [...(listeners.get(name) ?? []), cb]);
          return () =>
            listeners.set(
              name,
              (listeners.get(name) ?? []).filter((x) => x !== cb),
            );
        },
        EventsOff: () => {},
        EventsEmit: (name: string, ...data: unknown[]) => (listeners.get(name) ?? []).forEach((cb) => cb(...data)),
        ClipboardSetText: async () => true,
        WindowToggleMaximise: () => {},
        LogPrint: () => {},
        LogTrace: () => {},
        LogDebug: () => {},
        LogInfo: () => {},
        LogWarning: () => {},
        LogError: () => {},
        LogFatal: () => {},
      };
    },
    { fx: fixture, opts },
  );
}
