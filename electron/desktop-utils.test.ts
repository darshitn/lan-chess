import { describe, it, expect } from 'vitest';
import net from 'node:net';
// @ts-expect-error CJS module import
import desktopUtils from './desktop-utils.cjs';

const {
  pickPort,
  isValidPort,
  parseConnectArg,
  isAllowedNavigation,
  isSafeExternalUrl,
  resolveIconPath,
} = desktopUtils;

describe('desktop-utils: isValidPort', () => {
  it('accepts valid TCP ports', () => {
    expect(isValidPort(1)).toBe(true);
    expect(isValidPort(80)).toBe(true);
    expect(isValidPort(3001)).toBe(true);
    expect(isValidPort(65535)).toBe(true);
  });

  it('rejects invalid ports', () => {
    expect(isValidPort(0)).toBe(false);
    expect(isValidPort(-1)).toBe(false);
    expect(isValidPort(65536)).toBe(false);
    expect(isValidPort(99999)).toBe(false);
    expect(isValidPort(3.14)).toBe(false);
    expect(isValidPort('3001')).toBe(false);
    expect(isValidPort(null)).toBe(false);
    expect(isValidPort(undefined)).toBe(false);
  });
});

describe('desktop-utils: parseConnectArg', () => {
  it('parses valid IP with port', () => {
    const res = parseConnectArg('--connect=192.168.1.50:3001');
    expect(res).toEqual({
      hostname: '192.168.1.50',
      port: 3001,
      url: 'http://192.168.1.50:3001',
    });
  });

  it('parses valid hostname without port using default', () => {
    const res = parseConnectArg('--connect=chess.local', 3001);
    expect(res).toEqual({
      hostname: 'chess.local',
      port: 3001,
      url: 'http://chess.local:3001',
    });
  });

  it('parses localhost with custom port', () => {
    const res = parseConnectArg('localhost:8080');
    expect(res).toEqual({
      hostname: 'localhost',
      port: 8080,
      url: 'http://localhost:8080',
    });
  });

  it('rejects schemes and protocol injection', () => {
    expect(parseConnectArg('--connect=http://192.168.1.50:3001')).toBeNull();
    expect(parseConnectArg('--connect=javascript:alert(1)')).toBeNull();
    expect(parseConnectArg('--connect=file:///etc/passwd')).toBeNull();
  });

  it('rejects credentials and path traversal', () => {
    expect(parseConnectArg('--connect=admin:pass@192.168.1.50')).toBeNull();
    expect(parseConnectArg('--connect=192.168.1.50/api/status')).toBeNull();
    expect(parseConnectArg('--connect=192.168.1.50?query=1')).toBeNull();
  });

  it('rejects out-of-range or malformed ports', () => {
    expect(parseConnectArg('--connect=192.168.1.50:0')).toBeNull();
    expect(parseConnectArg('--connect=192.168.1.50:70000')).toBeNull();
    expect(parseConnectArg('--connect=192.168.1.50:abc')).toBeNull();
  });

  it('rejects malformed hostnames', () => {
    expect(parseConnectArg('--connect=-invalid.host')).toBeNull();
    expect(parseConnectArg('--connect=invalid.host.')).toBeNull();
    expect(parseConnectArg('--connect=invalid host:3001')).toBeNull();
    expect(parseConnectArg('--connect=')).toBeNull();
  });
});

describe('desktop-utils: isAllowedNavigation', () => {
  const allowed = ['http://127.0.0.1:3001', 'http://192.168.1.50:3001'];

  it('allows exact origin matches and paths within allowed origins', () => {
    expect(isAllowedNavigation('http://127.0.0.1:3001', allowed)).toBe(true);
    expect(isAllowedNavigation('http://127.0.0.1:3001/', allowed)).toBe(true);
    expect(isAllowedNavigation('http://127.0.0.1:3001/api/status', allowed)).toBe(true);
    expect(isAllowedNavigation('http://192.168.1.50:3001/play', allowed)).toBe(true);
  });

  it('strictly rejects subdomain and domain-prefix spoofing', () => {
    // Classic prefix confusion attack: url.startsWith('http://127.0.0.1:3001')
    expect(isAllowedNavigation('http://127.0.0.1:3001.attacker.com', allowed)).toBe(false);
    expect(isAllowedNavigation('http://127.0.0.1:3002', allowed)).toBe(false);
    expect(isAllowedNavigation('http://localhost:3001', allowed)).toBe(false); // different origin from 127.0.0.1
    expect(isAllowedNavigation('https://evil.com', allowed)).toBe(false);
  });

  it('rejects invalid or non-http URLs', () => {
    expect(isAllowedNavigation('javascript:alert(1)', allowed)).toBe(false);
    expect(isAllowedNavigation('file:///C:/Windows', allowed)).toBe(false);
    expect(isAllowedNavigation('not-a-url', allowed)).toBe(false);
  });
});

describe('desktop-utils: isSafeExternalUrl', () => {
  it('accepts valid http and https URLs', () => {
    expect(isSafeExternalUrl('https://github.com/darshitn/lan-chess')).toBe(true);
    expect(isSafeExternalUrl('http://lichess.org')).toBe(true);
  });

  it('rejects unsafe schemes and malformed URLs', () => {
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('file:///C:/autoexec.bat')).toBe(false);
    expect(isSafeExternalUrl('data:text/html,<h1>hi</h1>')).toBe(false);
    expect(isSafeExternalUrl('shell:cmd.exe')).toBe(false);
    expect(isSafeExternalUrl('')).toBe(false);
    expect(isSafeExternalUrl('not a url')).toBe(false);
  });
});

describe('desktop-utils: resolveIconPath', () => {
  it('returns first existing file path', () => {
    const fakeExists = (p: string) => p === '/path/two/icon.ico';
    const result = resolveIconPath(
      ['/path/one/icon.ico', '/path/two/icon.ico', '/path/three/icon.ico'],
      fakeExists
    );
    expect(result).toBe('/path/two/icon.ico');
  });

  it('returns null if none exist', () => {
    const fakeExists = () => false;
    expect(resolveIconPath(['/a', '/b'], fakeExists)).toBeNull();
  });
});

describe('desktop-utils: pickPort', () => {
  it('selects the preferred port when it is available', async () => {
    // Find an ephemeral available port first
    const s = net.createServer();
    await new Promise<void>((resolve) => s.listen(0, '0.0.0.0', () => resolve()));
    const freePort = (s.address() as net.AddressInfo).port;
    await new Promise<void>((resolve) => s.close(() => resolve()));

    const res = await pickPort(freePort);
    expect(res.port).toBe(freePort);
    expect(res.preferred).toBe(true);
  });

  it('falls back to an ephemeral port when preferred is occupied', async () => {
    const blocker = net.createServer();
    await new Promise<void>((resolve) => blocker.listen(0, '0.0.0.0', () => resolve()));
    const occupiedPort = (blocker.address() as net.AddressInfo).port;

    try {
      const res = await pickPort(occupiedPort);
      expect(res.preferred).toBe(false);
      expect(res.port).not.toBe(occupiedPort);
      expect(res.port).toBeGreaterThan(0);
      expect(res.port).toBeLessThanOrEqual(65535);
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });
});

