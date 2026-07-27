// Executing the open request and cancelling it mid-flight.

import { get } from 'svelte/store';
import { errMsg } from '../shared/errors';
import { recordRun } from '../shared/stores';
import { CancelRequest, SendRequest } from '../../../wailsjs/go/main/App';
import { historyKey } from './drafts';
import { activeEnvVars, activeRoot, error, inheritedHeaders, request, sending } from './state';

export async function sendRequest() {
  const req = get(request);
  if (!req || get(sending)) return;
  error.set('');
  sending.set(true);
  const key = historyKey();
  try {
    // dynamic :var values live on the request itself (saved to its TOML)
    const resp = await SendRequest(req as never, get(activeEnvVars), req.vars ?? {}, get(inheritedHeaders), get(activeRoot) ?? '');
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
