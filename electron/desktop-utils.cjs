/**
 * LAN Chess — Desktop Security & Utility Helpers.
 *
 * Pure, testable functions for input validation, origin verification,
 * and port checks in the Electron main process.
 */
const { existsSync } = require('node:fs');
const net = require('node:net');

/**
 * Probes whether the preferred port is available on 0.0.0.0.
 * If available, returns { port: preferred, preferred: true }.
 * If occupied/error, binds to an ephemeral port (0) on 127.0.0.1 and returns { port, preferred: false }.
 *
 * @param {number} preferred
 * @returns {Promise<{ port: number, preferred: boolean }>}
 */
function pickPort(preferred) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => {
      const fallback = net.createServer();
      fallback.listen(0, '127.0.0.1', () => {
        const addr = fallback.address();
        const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
        fallback.close(() => resolve({ port, preferred: false }));
      });
    });
    probe.listen(preferred, '0.0.0.0', () => {
      const addr = probe.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : preferred;
      probe.close(() => resolve({ port, preferred: true }));
    });
  });
}

/**
 * Validates whether a given port is a valid TCP port (1–65535).
 * @param {unknown} port
 * @returns {boolean}
 */
function isValidPort(port) {
  return typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535;
}

/**
 * Parses and strictly validates a --connect CLI argument.
 * Formats supported:
 *   --connect=192.168.1.66:3001
 *   --connect=192.168.1.66
 *   --connect=localhost:3001
 *
 * Rejects schemes (http://, file://), credentials (user@), paths (/api),
 * invalid characters, and out-of-range ports (>65535 or <=0).
 *
 * @param {string} rawArg - The raw argument or value
 * @param {number} [defaultPort=3001]
 * @returns {{ hostname: string, port: number, url: string } | null}
 */
function parseConnectArg(rawArg, defaultPort = 3001) {
  if (typeof rawArg !== 'string') return null;
  let val = rawArg.trim();
  if (val.startsWith('--connect=')) {
    val = val.slice('--connect='.length).trim();
  }
  if (!val) return null;

  // Disallow schemes, credentials, paths, query strings, fragments
  if (/[:/@?#]/.test(val.replace(/:\d+$/, ''))) {
    return null;
  }

  const parts = val.split(':');
  if (parts.length > 2) return null;

  const hostname = parts[0].trim();
  // Valid hostname characters: alphanumeric, hyphens, dots
  if (!/^[a-zA-Z0-9.-]+$/.test(hostname)) return null;
  // Disallow leading/trailing dots or hyphens
  if (hostname.startsWith('.') || hostname.endsWith('.') || hostname.startsWith('-') || hostname.endsWith('-')) {
    return null;
  }

  let port = defaultPort;
  if (parts.length === 2) {
    const portStr = parts[1].trim();
    if (!/^\d{1,5}$/.test(portStr)) return null;
    const parsed = Number(portStr);
    if (!isValidPort(parsed)) return null;
    port = parsed;
  }

  return {
    hostname,
    port,
    url: `http://${hostname}:${port}`,
  };
}

/**
 * Determines whether a URL navigation is within the strictly allowed origins.
 * Avoids permissive string prefix checks (e.g. "http://127.0.0.1:3001.attacker.com").
 *
 * @param {string} targetUrl
 * @param {string[]} allowedOrigins - Array of exact origins, e.g. ["http://127.0.0.1:3001"]
 * @returns {boolean}
 */
function isAllowedNavigation(targetUrl, allowedOrigins) {
  if (typeof targetUrl !== 'string' || !Array.isArray(allowedOrigins)) return false;
  try {
    const parsed = new URL(targetUrl);
    return allowedOrigins.some((origin) => {
      try {
        const allowed = new URL(origin);
        return parsed.origin === allowed.origin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * Validates that an external URL is safe to open in the system browser.
 * Only allows http: and https: protocols.
 *
 * @param {string} targetUrl
 * @returns {boolean}
 */
function isSafeExternalUrl(targetUrl) {
  if (typeof targetUrl !== 'string') return false;
  try {
    const parsed = new URL(targetUrl);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Resolves the first existing icon path from candidate locations.
 *
 * @param {string[]} candidates
 * @param {(p: string) => boolean} [existsFn]
 * @returns {string | null}
 */
function resolveIconPath(candidates, existsFn = existsSync) {
  if (!Array.isArray(candidates)) return null;
  for (const candidate of candidates) {
    try {
      if (existsFn(candidate)) return candidate;
    } catch {
      // Continue searching
    }
  }
  return null;
}

module.exports = {
  pickPort,
  isValidPort,
  parseConnectArg,
  isAllowedNavigation,
  isSafeExternalUrl,
  resolveIconPath,
};

