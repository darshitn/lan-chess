# PROJECT.md — LAN Chess In-App Windows Updater (v1.2.0)

## Problem Statement

LAN Chess currently distributes Windows desktop builds as standalone NSIS installers published to GitHub Releases (`LAN-Chess-Setup-<version>.exe`). While installation is clean and self-contained, updating requires users to manually navigate to GitHub, compare version strings, download a new ~122 MB installer, and execute it manually.

This friction leads to:
1. **Network Version Fragmentation**: Players on the same LAN run divergent versions, leading to protocol mismatches, missing bug fixes (e.g., host IP display, clock increment sync), and degraded multiplayer experiences.
2. **Manual Overhead**: Casual users are unlikely to actively check GitHub for maintenance and patch releases.
3. **Bandwidth Waste**: Downloading the full installer repeatedly wastes network resources compared to differential blockmap updates.

## Target Users

1. **Home & Dorm LAN Players**: Users who host or join chess matches with friends/family across a Wi-Fi network and need the app to remain compatible with their peers effortlessly.
2. **Offline Chess Enthusiasts**: Users playing against the built-in Stockfish engine or solving puzzles who want bug fixes and engine improvements without browsing external websites.
3. **Non-Technical Desktop Users**: Players on Windows 10/11 who expect standard modern desktop app behavior: automated check at launch, visible download progress, and a non-disruptive, user-initiated update restart.

## Project Goals

- **Automated Update Lifecycle**: Integrate `electron-updater` with the existing GitHub Releases NSIS distribution pipeline.
- **Active Game Protection**: Strictly forbid automatic restarts or update installations while any LAN multiplayer or offline computer game is in progress.
- **Transparency & Control**: Display update availability, download progress, and network errors clearly in the UI. Provide both background checks on startup and a manual "Check for Updates" control in Settings.
- **Integrity Without Compromise**: Preserve cryptographic SHA-512 blockmap verification without disabling security checks or monkey-patching verification routines.
- **Zero Data Loss**: Ensure all local preferences, custom board themes, and saved game history are preserved seamlessly across updates.
- **Clear Migration Path**: Document and communicate that legacy v1.1.0 / v1.1.1 users must perform one manual installer upgrade to v1.2.0 to bootstrap in-app updating capability.

## Core Features

1. **GitHub Releases Auto-Updater Provider**:
   - Configured with `provider: "github"`, `owner: "darshitn"`, `repo: "lan-chess"`.
   - Generates and publishes `latest.yml`, `LAN-Chess-Setup-${version}.exe`, and `.blockmap`.
2. **Main-Process Lifecycle & Safe IPC Bridge**:
   - `autoUpdater` initialized and managed exclusively in Electron's main process.
   - Narrow, validated preload bridge exposing typed methods: `getUpdateStatus()`, `checkForUpdates()`, `quitAndInstall()`, `setGameActive()`, and `onUpdateStatus()`.
   - Strict rate-limiting and input validation preventing unauthorized IPC calls or arbitrary URL loads.
3. **Renderer UI & User Control**:
   - **Settings Integration**: New "Desktop Updates" section in Settings with current version display, check button, download progress indicator, and "Restart & Update Now" button.
   - **Active-Game Lockout**: Disable restart action and reject IPC install requests if `gameState.status === 'active'` or `isComputerGameActive === true`.
   - **Status Feedback**: Clear accessible announcements for checking, available, downloading (percentage + speed), downloaded, and error states.
4. **Differential NSIS Blockmap Downloads**:
   - Downloads only changed binary chunks via `.blockmap`, reducing update transfer sizes drastically.
5. **Offline & Failure Resilience**:
   - Network disconnections or server errors during update checks/downloads fail gracefully without crashes, showing clear retry actions.

## MVP Scope (v1.2.0)

- Bump application version to `1.2.0`.
- Install and configure `electron-updater` in `package.json` (`build.publish`).
- Create `electron/updater.cjs` module managing updater state, logging, and events.
- Expose typed updater bridge in `electron/preload.cjs`.
- Implement update UI in `client/components/SettingsModal.tsx` and active game tracking in `client/App.tsx`.
- Add unit tests for updater utilities, status transitions, and active-game guards.
- Implement automated test script verifying offline error handling, blockmap validation, and update lockout during active play.
- Update public documentation with bootstrapping notes.

## Advanced Features (Post-v1.2.0)

- Configurable release channels (Stable vs Beta/Preview).
- Delta update bandwidth savings statistics shown to user.
- Peer-assisted LAN update distribution (seeding the installer locally to other LAN clients).

## Constraints & Non-Negotiables

- **No Mid-Game Disruptions**: Never terminate the background server or restart the window while a game is active.
- **Security & Integrity**: Never set `verifyUpdateCodeSignature: false` or bypass SHA-512 verification. Maintain strict context isolation and sandboxing.
- **State Preservation**: Preserve `%APPDATA%\lan-chess` and all localStorage items (custom themes, statistics, history).
- **Narrow Bridge**: Do not expose raw Node or Electron APIs to the renderer.
- **Git Cleanliness**: Keep local scratch scripts, test installers, and internal reports untracked.

## Technical Challenges & Solutions

| Challenge | Solution |
| :--- | :--- |
| **Unsigned Windows Binary Verification** | Without an EV/OV certificate, `electron-updater` relies on TLS transport security to GitHub and SHA-512 cryptographic hashes in `latest.yml`. Do not disable integrity checks; adhere to electron-builder's standard hash verification. |
| **Active Game Detection** | Maintain a synchronized `isGameActive` state between the React state machine (`gameState.status === 'active'`) and the Electron main process via IPC. Main process refuses `quitAndInstall()` if active. |
| **Differential Blockmap Packaging** | Ensure electron-builder produces both `latest.yml` and `LAN-Chess-Setup-${version}.exe.blockmap` during `electron:build`, and include them in the GitHub release assets. |
| **Bootstrapping Legacy Installs** | v1.1.0/v1.1.1 lack the updater module. Clearly document in README and release notes that users need a single manual install of v1.2.0. |

## Chosen Technology Stack

- **Desktop Framework**: Electron 44 (`electron`, `electron-builder 26.15.3`)
- **Updater Library**: `electron-updater 6.8.9`
- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide icons
- **Backend / Rules**: Node.js, Express 5, Socket.IO 4, chess.js 1.4
- **Testing**: Vitest 4, Node test scripts with Chrome DevTools Protocol (CDP)
