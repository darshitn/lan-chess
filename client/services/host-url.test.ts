import { describe, it, expect, beforeEach } from 'vitest';
import { preserveHostUrl, storeHostUrl, getStoredHostUrl } from './host-url.js';

describe('host-url service: preserveHostUrl', () => {
  it('preserves existing fallback port URL when incoming payload URL is null or undefined', () => {
    const existingFallbackUrl = 'http://192.168.1.75:3002';

    expect(preserveHostUrl(existingFallbackUrl, null)).toBe(existingFallbackUrl);
    expect(preserveHostUrl(existingFallbackUrl, undefined)).toBe(existingFallbackUrl);
    expect(preserveHostUrl(existingFallbackUrl, '')).toBe(existingFallbackUrl);
  });

  it('updates existing host URL when a new valid fallback port URL arrives', () => {
    const existing = 'http://192.168.1.75:3001';
    const fallbackPortUrl = 'http://192.168.1.75:52345';

    expect(preserveHostUrl(existing, fallbackPortUrl)).toBe(fallbackPortUrl);
  });

  it('sets initial URL when no existing URL was present', () => {
    expect(preserveHostUrl(null, 'http://10.0.0.4:3001')).toBe('http://10.0.0.4:3001');
    expect(preserveHostUrl(null, null)).toBeNull();
  });
});

describe('host-url service: sessionStorage persistence', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
    // @ts-expect-error mock window
    globalThis.window = {
      sessionStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
      } as unknown as Storage,
    };
  });

  it('stores and retrieves fallback-port URL correctly', () => {
    storeHostUrl('http://192.168.1.100:3005');
    expect(getStoredHostUrl()).toBe('http://192.168.1.100:3005');

    storeHostUrl(null);
    expect(getStoredHostUrl()).toBeNull();
  });
});
