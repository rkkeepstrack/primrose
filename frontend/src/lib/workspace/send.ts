// Executing the open request and cancelling it mid-flight.

import { get } from 'svelte/store';
import { errMsg } from '../shared/errors';
import { dynamicVars, recordRun } from '../shared/stores';
import { CancelRequest, SendRequest } from '../../../wailsjs/go/main/App';
import { historyKey } from './drafts';
import { activeEnvVars, error, request, selectedPath, sending } from './state';

export async function sendRequest() {
  const req = get(request);
  if (!req || get(sending)) return;
  error.set('');
  sending.set(true);
  const key = historyKey();
  try {
    const dynValues = get(dynamicVars)[get(selectedPath) ?? ''] ?? {};
    const resp = await SendRequest(req as never, get(activeEnvVars), dynValues);
    recordRun(key, { at: new Date(), response: resp, error: null });
  } catch (e) {
    const msg = errMsg(e);
    recordRun(key, {
      at: new Date(),
      response: null,
      error: msg.includes('canceled') ? 'Canceled' : msg,
    });
  } finally {
    sending.set(false);
  }
}

export function cancelRequest() {
  CancelRequest();
}
