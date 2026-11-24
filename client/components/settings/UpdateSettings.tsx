import React, {useEffect, useState} from 'react';
import type {UpdateStatusPayload} from '../../../shared/types.js';
import { isDesktopApp, getDesktopUpdateStatus, checkForDesktopUpdates, quitAndInstallDesktopUpdate, subscribeToUpdateStatus, formatBytes, formatSpeed } from '../../services/desktop-updater.js';
import { version as webVersion } from '../../../package.json';

export function UpdateSettings({gameActive}: {gameActive: boolean}) {
  const desktop = isDesktopApp();
  const [version, setVersion] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<UpdateStatusPayload | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!desktop) return;
    let mounted = true;
    let receivedEvent = false;
    const unsubscribe = subscribeToUpdateStatus(status => {
      receivedEvent = true;
      setSnapshot(status);
      setError(null);
    });
    void getDesktopUpdateStatus().then(status => {
      if (mounted && !receivedEvent) setSnapshot(status);
    });
    void window.desktop?.getStatus().then(status => {
      if (mounted) setVersion(status.version);
    }).catch(() => {});
    return () => { mounted = false; unsubscribe(); };
  }, [desktop]);
  const state = snapshot?.status ?? 'idle';
  const release = snapshot?.info?.version;
  const busy = checking || ['checking','available','downloading'].includes(state);
  const checkUpdates = async () => {
    setError(null);
    setChecking(true);
    const result = await checkForDesktopUpdates();
    if (!result.success) setError(result.error ?? 'The update check failed. Try again.');
    setChecking(false);
  };
  const install = async () => {
    if (gameActive) return;
    const result = await quitAndInstallDesktopUpdate();
    if (!result.success) setError(result.message ?? 'The update could not be installed.');
  };
  return <section className="setting-stack">
    <div><h3>Application Updates</h3><p>{desktop ? 'Manage updates for this Windows installation.' : 'Your browser runs the version served by the host computer.'}</p></div>
    <dl className="setting-facts"><div><dt>{desktop ? 'Installed version' : 'Web client version'}</dt><dd>{desktop ? (version ? 'v'+version : 'Unavailable') : 'v'+webVersion}</dd></div></dl>
    {desktop && <div className="setting-stack">
      <div role="status">{error || snapshot?.error || ({
        idle:'Ready to check for updates.', checking:'Checking for updates…', available:`Preparing the download${release ? ' for v'+release : ''}…`,
        downloading:'Downloading update…', 'not-available':'LAN Chess is up to date.',
        downloaded:`Version ${release ?? ''} is ready to install.`, error:'The update check failed.',
      }[state])}</div>
      {state==='downloading' && snapshot?.progress && <div>
        <progress aria-label="Update download" max="100" value={snapshot.progress.percent}/>
        <p>{Math.round(snapshot.progress.percent)}% · {formatBytes(snapshot.progress.transferred)} / {formatBytes(snapshot.progress.total)} · {formatSpeed(snapshot.progress.bytesPerSecond)}</p>
      </div>}
      {state === 'downloaded' ? <div>{gameActive && <p>Finish or leave your match before restarting.</p>}
        <button type="button" className="action-button action-primary" disabled={gameActive} onClick={install}>Restart &amp; install update</button>
      </div> : <button type="button" className="action-button action-secondary" disabled={busy} onClick={checkUpdates}>{busy ? 'Checking or downloading…' : 'Check for Updates'}</button>}
    </div>}
  </section>;
}
