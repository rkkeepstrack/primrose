// The collection's session cookie jar: list, delete, clear, add.

import { AddCookie, ClearCookies, DeleteCookie, GetCookies } from '../../../wailsjs/go/main/App';
import { confirmDialog } from '../ui/dialogs';
import { runOp } from './op';

export interface Cookie {
  domain: string;
  path: string;
  name: string;
  value: string;
  expires: string;
  secure: boolean;
  httpOnly: boolean;
  hostOnly: boolean;
}

export async function loadCookies(root: string): Promise<Cookie[]> {
  return ((await GetCookies(root)) ?? []) as Cookie[];
}

export async function deleteCookie(root: string, c: Cookie) {
  await runOp(() => DeleteCookie(root, c.domain, c.path, c.name));
}

// asks first; returns without clearing if the user declines
export async function clearAllCookies(root: string) {
  if (!(await confirmDialog('Delete all session cookies of this collection?', true))) return;
  await runOp(() => ClearCookies(root));
}

export async function addCookie(root: string, draft: { domain: string; name: string; value: string }) {
  await runOp(() =>
    AddCookie(root, {
      domain: draft.domain.trim(),
      path: '/',
      name: draft.name.trim(),
      value: draft.value,
      expires: '',
      secure: false,
      httpOnly: false,
      hostOnly: false,
    } as never),
  );
}
