# Questions Requiring My Input

These are non-blocking — all work that could safely proceed has been completed. My recommendations are in place; change them if you disagree.

## Question 1 — Light UI theme scope

### Context
The light theme was effectively broken: white panels with dark-theme text utilities left large areas at ~2.5–4:1 contrast (fails WCAG AA). A full light redesign would touch nearly every component.

### Why it matters
Readability/accessibility of the light theme, vs. churn and redesign risk across all views.

### Options
A. Full light-theme redesign (every component gets light variants) — large diff, high regression surface.
B. Keep dark panel surfaces; only page chrome lightens — minimal, coherent, but "light mode" is subtle.
C. (Implemented) Keep white panels and remap the dark-theme text utility colors to readable dark equivalents **inside panels** via scoped CSS overrides — small contained diff, decent AA contrast.

### Recommended option
C

### Your recommendation
C is implemented (see `client/styles.css`, "Light theme" overrides). It fixes readability without a redesign. If you want a true light redesign later, say so and it can be done as its own pass.

### Blocking?
NO

## Question 2 — ESLint not added

### Context
The project had no linter. `typescript-eslint` (required to lint TypeScript) currently requires TypeScript `< 6.1`, but this toolchain runs TypeScript **7**. Adding it means either downgrading the compiler (high risk, unjustified) or installing with knowingly-broken peer dependencies.

### Why it matters
Lint catches hook-dependency bugs (the class of bug fixed in App.tsx this pass), but a broken toolchain or forced downgrades are worse.

### Options
A. Skip ESLint for now (chosen).
B. Downgrade TypeScript to 5.x to enable typescript-eslint.
C. Revisit when typescript-eslint ships TS 7 support.

### Recommended option
A now, C later.

### Your recommendation
I chose A. The `npm run lint` script is absent; when typescript-eslint supports TS 7, add `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks` with a flat config (`react-hooks/exhaustive-deps` as `warn`).

### Blocking?
NO

## Question 3 — Leftover probe file `test_sf.cjs`

### Context
An untracked scratch script from an earlier debugging session (`test_sf.cjs`) sits in the repo root. It crashes when run in Node (`eval` of the engine collides with its own `fs` require) and served its purpose (superseded by the engine test suite).

### Why it matters
Dead scratch files in the repo root are clutter, but it is untracked user work and I do not delete user files without confirmation.

### Options
A. Delete it (recommended).
B. Keep it for reference.

### Recommended option
A

### Your recommendation
Delete it; the scripted fake-worker test suite in `client/services/stockfish-engine.test.ts` covers everything it was probing, deterministically.

### Blocking?
NO

## Question 4 — Session identity security model

### Context
Player identity is a `sessionId` stored in localStorage and presented over the socket. On a LAN, any peer who obtains that string (e.g., by sniffing plaintext WS traffic) can reconnect as that player. I did not change this model.

### Why it matters
For a friendly LAN game this is a reasonable trust level, and fixing it properly (per-connection secrets, TLS, or token binding) changes the connection model.

### Options
A. Keep as-is (current, documented).
B. Bind a per-session secret issued over the first connection and require it on reconnect.
C. Add WSS with a self-signed cert (browser warnings on LAN devices).

### Recommended option
A for v1; B if the app is ever used on semi-trusted networks.

### Your recommendation
Keep A, revisit B before any use beyond a trusted home/college LAN.

### Blocking?
NO
