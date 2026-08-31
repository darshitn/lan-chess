# LAN Chess

LAN Chess is a local-network multiplayer chess game built with React, Vite, Express, Socket.IO, and chess.js.

## Features

- Local multiplayer over LAN
- Room-based matchmaking
- Real-time move sync using Socket.IO
- Chess rules handled by chess.js
- Reconnect-safe session identity using browser localStorage
- Time controls and authoritative server-side clocks
- Resign, draw offer, and rematch flow
- Host-side local play on the same machine or LAN devices

## Tech Stack

- Frontend: React + Vite
- Backend: Express + Socket.IO
- Shared types: TypeScript
- Rules engine: chess.js

## Running locally

1. Install dependencies:
   npm install
2. Start the app in development mode:
   npm run dev
3. Open the app in the browser using the local Vite address, or use the host IP shown by the server for LAN play.

## Production build

npm run build
npm start

## Notes

- This project is designed for local or LAN multiplayer usage.
- The server keeps authoritative game state in memory.
- For private GitHub hosting, keep the repository private until you are ready to share it publicly.
