import React, { useState } from 'react';
import { Chess } from 'chess.js';

interface PgnFenToolsProps {
  currentFen: string;
  pgnText?: string;
  onLoadFen?: (fen: string) => void;
  onLoadPgn?: (pgn: string) => void;
}

export const PgnFenTools: React.FC<PgnFenToolsProps> = ({
  currentFen,
  pgnText = '',
  onLoadFen,
  onLoadPgn,
}) => {
  const [fenInput, setFenInput] = useState('');
  const [pgnInput, setPgnInput] = useState('');
  const [copiedMsg, setCopiedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // navigator.clipboard is unavailable on insecure origins (this app is served
  // over plain HTTP on the LAN), so fall back to execCommand.
  const copyToClipboard = (text: string, label: string) => {
    const showCopied = () => {
      setCopiedMsg(`Copied ${label} to clipboard!`);
      setTimeout(() => setCopiedMsg(null), 2500);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(showCopied).catch(() => {
        setErrorMsg(`Could not copy ${label} to clipboard.`);
      });
      return;
    }

    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const success = document.execCommand('copy');
      document.body.removeChild(el);
      if (success) showCopied();
      else setErrorMsg(`Could not copy ${label} to clipboard.`);
    } catch {
      setErrorMsg(`Could not copy ${label} to clipboard.`);
    }
  };

  const downloadPgn = () => {
    if (!pgnText) return;
    const blob = new Blob([pgnText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lan-chess-game-${Date.now()}.pgn`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleApplyFen = () => {
    setErrorMsg(null);
    const trimmed = fenInput.trim();
    if (!trimmed) return;

    try {
      const testChess = new Chess();
      testChess.load(trimmed);
      onLoadFen?.(trimmed);
      setFenInput('');
      setCopiedMsg('Custom FEN position loaded successfully!');
      setTimeout(() => setCopiedMsg(null), 2500);
    } catch {
      setErrorMsg('Invalid FEN string. Please check the position format.');
    }
  };

  const handleApplyPgn = () => {
    setErrorMsg(null);
    const trimmed = pgnInput.trim();
    if (!trimmed) return;

    try {
      const testChess = new Chess();
      testChess.loadPgn(trimmed);
      onLoadPgn?.(trimmed);
      setPgnInput('');
      setCopiedMsg('PGN game loaded successfully into Review Board!');
      setTimeout(() => setCopiedMsg(null), 2500);
    } catch {
      setErrorMsg('Invalid PGN format. Could not parse chess moves.');
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">PGN & FEN Utilities</h3>
        {copiedMsg && (
          <span className="text-xs font-semibold text-emerald-400 animate-pulse">{copiedMsg}</span>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-rose-950/80 p-2 text-xs text-rose-300 border border-rose-800/60">
          {errorMsg}
        </div>
      )}

      {/* Export row */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => copyToClipboard(currentFen, 'FEN')}
          className="action-button action-secondary text-xs"
        >
          Copy Current FEN
        </button>

        {pgnText && (
          <button
            type="button"
            onClick={downloadPgn}
            className="action-button action-primary text-xs font-bold"
          >
            Download PGN File
          </button>
        )}
      </div>

      {/* Load FEN */}
      {onLoadFen && (
        <div className="border-t border-slate-800 pt-3">
          <label htmlFor="load-fen-input" className="block text-[11px] font-semibold text-slate-300">
            Load Position (FEN)
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="load-fen-input"
              type="text"
              value={fenInput}
              onChange={(e) => setFenInput(e.target.value)}
              placeholder="Paste FEN position..."
              className="field text-xs flex-1"
            />
            <button
              type="button"
              onClick={handleApplyFen}
              className="action-button action-secondary text-xs whitespace-nowrap"
            >
              Load FEN
            </button>
          </div>
        </div>
      )}

      {/* Load PGN */}
      {onLoadPgn && (
        <div className="border-t border-slate-800 pt-3">
          <label htmlFor="load-pgn-input" className="block text-[11px] font-semibold text-slate-300">
            Import Game (PGN)
          </label>
          <textarea
            id="load-pgn-input"
            value={pgnInput}
            onChange={(e) => setPgnInput(e.target.value)}
            placeholder="Paste standard PGN text..."
            rows={3}
            className="field text-xs font-mono"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleApplyPgn}
              className="action-button action-secondary text-xs"
            >
              Import PGN
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
