import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, summary, [tabindex]';

/**
 * Modal keyboard behavior: Escape closes the dialog, Tab is trapped inside it,
 * and focus moves to the dialog on open (returned to the trigger on close).
 * Attach the returned ref to the dialog container element (with tabIndex={-1}).
 *
 * Pass `escapeToClose: false` for dialogs that must not be dismissible, and
 * `active: false` when the host component stays mounted while hidden.
 */
export function useModalBehavior(
  onClose: (() => void) | null,
  escapeToClose = true,
  active = true
) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Kept in a ref so a fresh inline handler from the parent (which re-renders
  // every clock tick) does not tear down focus management mid-interaction.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      .filter(item => {
        if (item.matches(':disabled, [tabindex="-1"], input[type="hidden"]') || item.closest('[inert], [hidden]')) return false;
        const folded = item.closest('details:not([open])');
        if (folded && !folded.querySelector(':scope > summary')?.contains(item)) return false;
        for (let node: HTMLElement | null = item; node && node !== container; node = node.parentElement) {
          const style = window.getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
        }
        return true;
      });

    (focusables()[0] ?? container).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && escapeToClose && onCloseRef.current) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [escapeToClose, active]);

  return containerRef;
}
