import { describe, expect, it } from 'vitest';
import { getLanIp } from './network.js';

describe('getLanIp', () => {
  it('prefers a Wi-Fi address over virtual adapters', () => {
    const interfaces = {
      'Ethernet 2': [{ address: '192.168.56.1', family: 'IPv4', internal: false }],
      'Wi-Fi': [{ address: '192.168.1.70', family: 'IPv4', internal: false }],
    } as unknown as ReturnType<typeof import('node:os').networkInterfaces>;

    expect(getLanIp(interfaces)).toBe('192.168.1.70');
  });

  it('returns null when no external IPv4 address is available', () => {
    const interfaces = {
      Loopback: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
    } as unknown as ReturnType<typeof import('node:os').networkInterfaces>;

    expect(getLanIp(interfaces)).toBeNull();
  });
});
