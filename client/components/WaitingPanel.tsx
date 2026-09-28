import React, { useEffect, useState } from 'react';
import { copyToClipboard } from '../services/clipboard.js';
import { buildFullInviteText, buildLinkInviteText, buildRoomInviteUrl } from '../services/invite.js';

interface WaitingPanelProps {
  roomCode: string;
  hostUrl: string | null;
}

export const WaitingPanel: React.FC<WaitingPanelProps> = ({ roomCode, hostUrl }) => {
  const inviteUrl = buildRoomInviteUrl(roomCode, hostUrl);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    let current = true;
    setQrImage(null);
    setQrError(false);
    if (inviteUrl) {
      void import('qrcode').then(({ toDataURL }) =>
        toDataURL(inviteUrl, { width: 180, margin: 2, errorCorrectionLevel: 'M' })
      )
        .then((image) => { if (current) setQrImage(image); })
        .catch(() => { if (current) setQrError(true); });
    }
    return () => { current = false; };
  }, [inviteUrl]);

  const handleCopyLink = async () => {
    if (!hostUrl) {
      setFeedback({
        type: 'error',
        message: 'Copy failed — select the address above and copy it manually.',
      });
      return;
    }
    const text = buildLinkInviteText(hostUrl);
    const result = await copyToClipboard(text);
    if (result.success) {
      setFeedback({ type: 'success', message: 'LAN link copied' });
    } else {
      setFeedback({
        type: 'error',
        message: 'Copy failed — select the address above and copy it manually.',
      });
    }
  };

  const handleCopyFullInvite = async () => {
    const text = buildFullInviteText(roomCode, hostUrl);
    const result = await copyToClipboard(text);
    if (result.success) {
      setFeedback({ type: 'success', message: 'Invite copied' });
    } else {
      setFeedback({
        type: 'error',
        message: 'Copy failed — select the address above and copy it manually.',
      });
    }
  };

  return (
    <section
      className="mb-3 rounded-xl border border-amber-500/50 bg-amber-950/30 p-3 sm:p-3.5 text-slate-200 shadow-lg"
      aria-label="Waiting for opponent invitation instructions"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="text-sm font-bold text-amber-300">Waiting for an opponent</h2>
          </div>
        </div>
        <p className="text-xs text-slate-300">
          On another device connected to the same Wi-Fi, scan the QR code or open this address and enter the room code.
        </p>

        {inviteUrl && (
          <details className="rounded-lg border border-slate-700 bg-slate-900/90 p-2 sm:self-start">
            <summary className="cursor-pointer text-xs font-semibold text-amber-300">Scan QR to join</summary>
            <div className="mt-2 flex flex-col items-center gap-1.5">
            {qrError ? (
              <p className="max-w-44 text-center text-xs text-amber-300" role="status">
                QR unavailable. Share the link and room code below instead.
              </p>
            ) : qrImage ? (
              <img
                src={qrImage}
                width="180"
                height="180"
                alt={`Scan to open the Join form for room ${roomCode}`}
                className="rounded bg-white"
                data-testid="room-invite-qr"
              />
            ) : (
              <div className="flex h-[180px] w-[180px] items-center justify-center text-xs text-slate-400" role="status">
                Preparing QR code…
              </div>
            )}
            <span className="text-[11px] text-slate-300">Scan to open Join with code {roomCode}</span>
            </div>
          </details>
        )}

        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="action-button action-secondary flex-1 px-2.5 py-1.5 text-xs font-semibold text-center"
            aria-label="Copy LAN link"
          >
            Copy Link
          </button>
          <button
            type="button"
            onClick={handleCopyFullInvite}
            className="action-button action-primary flex-1 px-2.5 py-1.5 text-xs font-bold text-center"
            aria-label="Copy full invite"
          >
            Copy Full Invite
          </button>
        </div>
      </div>

      {/* 3 Step Instruction List */}
      <ol className="mt-2.5 flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/90 p-2.5 text-xs">
        <li className="flex items-start gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 font-bold text-amber-300">
            1
          </span>
          <div>
            <span className="font-semibold text-white">Connect device:</span>
            <p className="mt-0.5 text-[11px] text-slate-300">Connect the other device to the same Wi-Fi.</p>
          </div>
        </li>

        <li className="flex items-start gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 font-bold text-amber-300">
            2
          </span>
          <div className="min-w-0 flex-1">
            <span className="font-semibold text-white">Open:</span>
            {hostUrl ? (
              <div className="mt-0.5">
                <span
                  data-testid="lan-url"
                  className="inline-block rounded border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-xs font-bold text-amber-300 select-all break-all"
                  title="Select or copy URL"
                >
                  {hostUrl}
                </span>
              </div>
            ) : (
              <p
                data-testid="lan-missing-explanation"
                className="mt-0.5 text-[11px] font-medium text-amber-400"
              >
                No local network IP detected. Ensure this host device is connected to Wi-Fi or Ethernet.
              </p>
            )}
          </div>
        </li>

        <li className="flex items-start gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 font-bold text-amber-300">
            3
          </span>
          <div>
            <span className="font-semibold text-white">Enter room code:</span>
            <div className="mt-0.5">
              <span
                data-testid="room-code"
                className="inline-block rounded border border-slate-700 bg-slate-950 px-2.5 py-0.5 font-mono text-base font-black tracking-widest text-white select-all"
              >
                {roomCode}
              </span>
            </div>
          </div>
        </li>
      </ol>

      {/* Advisory Note */}
      <p className="mt-2 text-[11px] text-slate-400 flex items-start gap-1.5 leading-snug">
        <span aria-hidden="true" className="shrink-0">ℹ️</span>
        <span>Note: Guest or public Wi-Fi networks may block communication between devices (AP isolation).</span>
      </p>

      {/* Accessible Feedback */}
      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`mt-2 flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium ${
            feedback.type === 'error'
              ? 'border border-rose-800 bg-rose-950/90 text-rose-200'
              : 'border border-emerald-800 bg-emerald-950/90 text-emerald-200'
          }`}
        >
          <span className="break-words">{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="ml-2 text-[11px] opacity-75 hover:opacity-100 shrink-0"
            aria-label="Dismiss feedback"
          >
            ✕
          </button>
        </div>
      )}
    </section>
  );
};
