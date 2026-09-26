/**
 * LAN Chess — Host URL Management & Preservation.
 */

const HOST_URL_STORAGE_KEY = 'lan-chess-host-url';

export function getStoredHostUrl(): string | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    return window.sessionStorage.getItem(HOST_URL_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeHostUrl(url: string | null): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    if (url) {
      window.sessionStorage.setItem(HOST_URL_STORAGE_KEY, url);
    } else {
      window.sessionStorage.removeItem(HOST_URL_STORAGE_KEY);
    }
  } catch {
    // Quota or private mode
  }
}

/**
 * Preserves the existing valid host URL unless a new non-null URL is received.
 * Prevents transient nulls or reconnect payloads from wiping out the known host link.
 */
export function preserveHostUrl(
  existing: string | null,
  incoming?: string | null
): string | null {
  if (incoming && typeof incoming === 'string' && incoming.trim().length > 0) {
    return incoming.trim();
  }
  return existing;
}
