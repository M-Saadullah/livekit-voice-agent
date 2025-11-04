# Frontend (React + Vite)

Single-page app that connects to a LiveKit room for a voice session. It requests a token from the backend and joins with your LiveKit server URL.

## Setup
```
npm install
npm run dev
```
Open the printed URL (default `http://localhost:3000`).

## Configure
- In the UI, set your `LiveKit Server URL` (e.g., `wss://your-project.livekit.cloud`).
- The app calls `/api/get-token` (proxied to `http://localhost:3001`) to obtain a token.
- Each Connect uses a fresh room name (e.g., `voice-agent-xxxxx`).

## Features
- Connect/Disconnect UI
- Microphone publish and mute toggle
- Verbose console logs for token fetch, connection, tracks, speakers
- Audio element controls displayed; attempts autoplay and sets sink to default device if supported

## Troubleshooting
- If you don’t hear audio, click once in the page after connect (autoplay policy), verify output device/volume, and check browser Console logs.
- Ensure backend is running and reachable at `http://localhost:3001`.

## Commands
- `npm run dev` start dev server
- `npm run build` production build
- `npm run preview` preview build


