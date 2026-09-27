# AI_INSTRUCTIONS.md — Guidelines for AI Coding Assistants

This repository follows strict architectural, security, and quality control conventions. Every AI agent working on LAN Chess must read and adhere to these instructions.

---

## 1. Core Principles

1. **Do Not Rewrite Working Systems**: Always inspect existing implementations before modifying anything. Reuse existing architectural patterns, design tokens, and components.
2. **Never Disrupt Ongoing Games**: All desktop update, restart, or maintenance routines must be strictly blocked if `isGameActive === true` (either LAN multiplayer or offline vs Computer).
3. **No Speculative Dependencies**: Avoid adding unnecessary external packages. Use standard Node and Electron built-ins wherever possible.
4. **Preserve Documentation Integrity**: Keep internal notes (`AUDIT.md`, `DESKTOP_RELEASE_REPORT.md`, `ENGINEERING_REPORT.md`, `RELEASE_V1_REPORT.md`, `ROAD_MAP.md`) out of Git. Maintain public documentation (`README.md`, `CHANGELOG.md`, `DESKTOP_APP.md`).
5. **Work Milestone by Milestone**: Do not build entire features in one massive unverified leap. Keep the repository in a runnable, testable state after each step.

---

## 2. Desktop & Electron Guidelines

1. **Least Privilege Context Bridge**:
   - Never expose raw `ipcRenderer`, `shell`, or `child_process` to the renderer.
   - All renderer bridge methods under `window.desktop` must have strict input validation (string length bounds, boolean types, sanitized payloads).
2. **Main Process Domain Isolation**:
   - Keep file system access, auto-updater management, and background server spawning strictly within Electron's main process (`electron/main.cjs`, `electron/updater.cjs`).
   - Use IPC events to broadcast sanitized state snapshots to the renderer.
3. **Security Standards**:
   - Always ensure `contextIsolation: true` and `nodeIntegration: false`.
   - Never set `verifyUpdateCodeSignature: false` or bypass SHA-512 blockmap verification.
   - Enforce navigation lockdown: block arbitrary origin loads; open external links in the default browser.

---

## 3. Code Style & Conventions

- **TypeScript / React**: Strict type safety; no `any` types where preventable; explicit component props and return types.
- **Styling**: Vanilla Tailwind CSS using existing design tokens (`bg-slate-900`, `border-slate-800`, `text-amber-400`, etc.). Match the aesthetics of the existing UI.
- **CommonJS in Electron**: `electron/` scripts are CommonJS (`.cjs`) to match Electron's native loader without ESM friction.

---

## 4. Verification Gate (Mandatory Before Committing)

Before completing any task or milestone, run the full verification gate:
```bash
npm test                # All unit and integration tests must pass
npm run typecheck       # Zero TypeScript diagnostics
npm run build           # Production bundle must compile cleanly
npm audit --omit=dev    # 0 production vulnerabilities
npm audit               # 0 total vulnerabilities
git diff --check        # Clean whitespace and line endings
```
