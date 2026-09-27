/// <reference types="vite/client" />

import type { DesktopBridge } from '../shared/types.js';

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}
