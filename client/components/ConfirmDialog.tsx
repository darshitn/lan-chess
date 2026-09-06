import React from 'react';
import { useModalBehavior } from '../utils/modal-behavior.js';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * In-app confirmation dialog. Replaces window.confirm(), which is suppressed
 * or broken in some browsers (e.g. Arc), leaving actions silently dead.
 * Cancel is focused first so Enter never confirms a destructive action by
 * accident; Escape cancels.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}) => {
  const modalRef = useModalBehavior(onCancel);

  return (
    <div
      className="promotion-backdrop z-50"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <div ref={modalRef} tabIndex={-1} className="promotion-dialog focus:outline-none">
        <p className="text-xs font-bold uppercase tracking-[.25em] text-amber-400">Confirm</p>
        <h2 className="mt-1 text-xl font-black text-white">{title}</h2>
        <p className="mt-2 text-sm text-slate-300">{message}</p>
        <div className="mt-5 flex gap-2 border-t border-slate-700/60 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="action-button action-secondary flex-1 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`action-button flex-1 text-sm font-bold ${
              danger
                ? 'bg-rose-600 text-white hover:bg-rose-500'
                : 'action-primary'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
