# TASKS.md — Granular Development Checklist

## Milestone 1: Dependency & Updater Infrastructure
- [x] 1.1 Add `electron-updater` (`^6.8.9`) to `package.json` dependencies.
- [x] 1.2 Bump version in `package.json` and synchronize `package-lock.json` to `1.2.0`.
- [x] 1.3 Add `publish` configuration to `package.json` (`build.publish`: `provider: "github"`, `owner: "darshitn"`, `repo: "lan-chess"`).
- [x] 1.4 Define shared updater TypeScript types in `shared/types.ts` (`UpdateStatusState`, `UpdateProgressPayload`, `UpdateInfoPayload`).
- [x] 1.5 Implement `electron/updater.cjs` with `autoUpdater` setup, state machine, logging, and error handling.
- [x] 1.6 Implement IPC handlers in `electron/updater.cjs` (`desktop:updater-get-status`, `desktop:updater-check`, `desktop:updater-quit-and-install`, `desktop:updater-set-game-active`).
- [x] 1.7 Expose safe typed methods in `electron/preload.cjs` (`getUpdateStatus`, `checkForUpdates`, `quitAndInstall`, `setGameActive`, `onUpdateStatus`).
- [x] 1.8 Add unit tests in `electron/updater.test.ts` for IPC payload validation, state transitions, and lockout logic.

## Milestone 2: UI Integration & Active Game Protection
- [x] 2.1 Create `client/services/desktop-updater.ts` to manage subscription, state dispatch, and web fallbacks.
- [x] 2.2 Wire `setGameActive` in `client/App.tsx` whenever `gameState.status === 'active'` or `isComputerGameActive === true`.
- [x] 2.3 Update `client/components/settings/SettingsModal.tsx` with "Desktop Updates" section:
  - [x] Display current version.
  - [x] "Check for Updates" trigger button with loading spinner.
  - [x] Real-time progress bar for downloading updates with speed & size indicators.
  - [x] "Restart & Update Now" button when update is downloaded.
  - [x] Lockout feedback when a game is in progress.
  - [x] Error alert banner with retry action on failure.
- [x] 2.4 Add `client/components/UpdateBanner.tsx` for unobtrusive lobby notification when an update is ready.
- [x] 2.5 Add unit tests for `desktop-updater` service.

## Milestone 3: Packaging, Differential Blockmaps & Automated Testing
- [x] 3.1 Verify `npm run electron:build` produces `latest.yml`, `LAN-Chess-Setup-1.2.0.exe.blockmap`, and installer.
- [x] 3.2 Build automated test script `scripts/test-updater.mjs` verifying:
  - [x] Status query and manual check API.
  - [x] Rejection of update restart when game is active.
  - [x] Graceful handling of offline/network failure states.
  - [x] Local storage data preservation across simulated install.
- [x] 3.3 Execute `scripts/test-updater.mjs` against built app.

## Milestone 4: Verification, Documentation & Final Commit
- [x] 4.1 Run full verification: `npm test`, `npm run typecheck`, `npm run build`, `npm audit --omit=dev`, `npm audit`, `git diff --check`.
- [x] 4.2 Update `README.md` and `CHANGELOG.md` for v1.2.0 with in-app updater details and bootstrapping instructions.
- [x] 4.3 Verify clean working tree and commit milestone changes locally.
