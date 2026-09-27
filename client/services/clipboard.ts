/**
 * LAN Chess — Reusable typed clipboard helper.
 *
 * Execution order:
 * 1. Electron desktop application via preload bridge (window.desktop.copyText)
 * 2. Secure browser context via navigator.clipboard.writeText
 * 3. Fallback via hidden textarea document.execCommand('copy')
 * 4. Return typed success/failure result.
 */

export type ClipboardMethod = 'desktop' | 'navigator' | 'legacy';

export type ClipboardResult =
  | { success: true; method: ClipboardMethod }
  | { success: false; error: string };

export async function copyToClipboard(text: string): Promise<ClipboardResult> {
  if (typeof text !== 'string' || text.length === 0) {
    return { success: false, error: 'Nothing to copy' };
  }

  // 1. Electron desktop application
  if (
    typeof window !== 'undefined' &&
    window.desktop &&
    typeof window.desktop.copyText === 'function'
  ) {
    try {
      const ok = await window.desktop.copyText(text);
      if (ok) {
        return { success: true, method: 'desktop' };
      }
    } catch {
      // Desktop bridge invocation failed, try browser APIs
    }
  }

  // 2. Navigator clipboard API (secure browser context)
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return { success: true, method: 'navigator' };
    } catch {
      // Navigator rejected (e.g. document not focused, permission denied);
      // proceed to legacy execCommand fallback!
    }
  }

  // 3. Hidden textarea document.execCommand('copy') fallback
  if (typeof document !== 'undefined') {
    let textarea: HTMLTextAreaElement | null = null;
    try {
      textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      if (success) {
        return { success: true, method: 'legacy' };
      }
    } catch {
      // Legacy copy threw
    } finally {
      if (textarea && textarea.parentNode) {
        textarea.parentNode.removeChild(textarea);
      }
    }
  }

  // 4. Return typed failure
  return { success: false, error: 'Clipboard copy failed' };
}
