import { describe, expect, it } from 'vitest';
import { maskEntries, maskSecrets, secretValues } from '../../lib/shared/secrets';
import type { Environment } from '../../lib/shared/types';

const env: Environment = {
  name: 'staging',
  path: '/c/environments/staging.toml',
  vars: { api_url: 'https://api.staging', api_token: 'sk-abc123', db_pass: '' },
  headers: {},
  secrets: ['api_token', 'db_pass'],
  missingSecrets: ['db_pass'],
};

describe('secretValues', () => {
  it('returns only secrets that have a value', () => {
    expect(secretValues(env)).toEqual({ api_token: 'sk-abc123' });
  });

  it('is empty for null env', () => {
    expect(secretValues(null)).toEqual({});
  });
});

describe('maskSecrets', () => {
  it('replaces every occurrence with the placeholder', () => {
    expect(maskSecrets('Bearer sk-abc123 and sk-abc123', { api_token: 'sk-abc123' })).toBe(
      'Bearer {{api_token}} and {{api_token}}',
    );
  });

  it('leaves strings without secrets alone and ignores empty values', () => {
    expect(maskSecrets('hello', { api_token: 'sk-abc123', empty: '' })).toBe('hello');
  });
});

describe('maskEntries', () => {
  it('masks values of a header map', () => {
    expect(maskEntries({ Authorization: 'Bearer sk-abc123', Accept: 'application/json' }, secretValues(env))).toEqual({
      Authorization: 'Bearer {{api_token}}',
      Accept: 'application/json',
    });
  });
});
