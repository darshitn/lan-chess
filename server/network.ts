import { networkInterfaces } from 'node:os';

type Interfaces = ReturnType<typeof networkInterfaces>;

/** Returns the most likely address other devices can use to reach this host. */
export function getLanIp(interfaces: Interfaces = networkInterfaces()): string | null {
  const candidates: Array<{ name: string; address: string }> = [];

  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        candidates.push({ name, address: address.address });
      }
    }
  }

  const physicalNetwork = candidates.find(({ name }) => /wi-?fi|wlan/i.test(name))
    ?? candidates.find(({ name }) => /ethernet/i.test(name) && !/virtual|wsl|vmware|vbox/i.test(name));
  return physicalNetwork?.address ?? candidates[0]?.address ?? null;
}
