import React, { useEffect, useState } from 'react';
import { copyToClipboard } from '../services/clipboard.js';
import { buildFullInviteText, buildRoomInviteUrl } from '../services/invite.js';

import './club.css';

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
        toDataURL(inviteUrl, { scale: 8, margin: 4, errorCorrectionLevel: 'M' })
      )
        .then((image) => { if (current) setQrImage(image); })
        .catch(() => { if (current) setQrError(true); });
    }
    return () => { current = false; };
  }, [inviteUrl]);

  async function copyInvite(full: boolean) {
    const text = full ? buildFullInviteText(roomCode, hostUrl) : inviteUrl;
    if (!text) return;
    const result = await copyToClipboard(text);
    setFeedback(result.success
      ? { type: 'success', message: full ? 'Invite copied' : 'Room link copied' }
      : { type: 'error', message: 'Copy failed. Select the room details and copy them manually.' });
  }

  return (
    <section className="club-invite" aria-label="Waiting for opponent invitation instructions">
      <h2>Waiting for an opponent</h2>
      <p>Connect the other device to the same Wi-Fi.</p>
      <div className="invite-ticket">
        {inviteUrl && !qrError && (
          <div className="invite-qr">
            {qrImage ? (
              <img src={qrImage} width="132" height="132" alt={`Scan to open the Join form for room ${roomCode}`} data-testid="room-invite-qr" />
            ) : <span role="status">Preparing QR code...</span>}
          </div>
        )}
        <div className="invite-credentials">
          <dl><dt>Room code</dt><dd data-testid="room-code">{roomCode}</dd></dl>
          {inviteUrl && <p>{qrError ? 'Share the link to join.' : 'Scan with a phone camera to join.'}</p>}
        </div>
      </div>
      {hostUrl ? (
        <dl className="invite-address"><dt>Host address</dt><dd data-testid="lan-url">{hostUrl}</dd></dl>
      ) : <p data-testid="lan-missing-explanation">No local network IP detected. Ensure this host device is connected to Wi-Fi or Ethernet.</p>}
      <div className="club-invite-actions">
        <button type="button" onClick={() => void copyInvite(false)} disabled={!inviteUrl} className="action-button action-primary" aria-label="Copy LAN link">Copy Link</button>
        <button type="button" onClick={() => void copyInvite(true)} className="action-button action-secondary" aria-label="Copy full invite">Copy Full Invite</button>
      </div>
      {feedback && <p role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.message}</p>}
      <details>
        <summary>Connection help</summary>
        <p>Guest or public Wi-Fi networks may block communication between devices. Try a private network that allows devices to connect.</p>
      </details>
    </section>
  );
};
