# LiveKit Voice Agent - Monorepo

This project contains a minimal backend for issuing LiveKit access tokens and a simple React + Vite frontend that connects to a LiveKit room for a voice session.

- Backend: Node/Express token server at `livekit-voice-agent/backend`
- Frontend: React/Vite app at `livekit-voice-agent/frontend`
- Optional Python agent code at `livekit-voice-agent/livekit-voice-agent`

## Project Structure
```
livekit-voice-agent/
├─ backend/
│  ├─ server.js               # Express server: token + admin endpoints
│  ├─ package.json            # Backend deps & scripts
│  ├─ package-lock.json
│  └─ .env                    # LIVEKIT_API_KEY/SECRET/HOST (ignored)
│
├─ frontend/
│  ├─ index.html              # Vite entry
│  ├─ main.jsx                # React bootstrap
│  ├─ frontend.jsx            # UI logic for joining room, audio, logs
│  ├─ index.css               # Tailwind base
│  ├─ package.json            # Frontend deps & scripts
│  ├─ vite.config.js          # Dev server + /api proxy → 3001
│  ├─ tailwind.config.js
│  └─ postcss.config.js
│
├─ livekit-voice-agent/       # (optional) Python agent module
│  ├─ agent.py
│  ├─ Dockerfile
│  ├─ pyproject.toml
│  └─ uv.lock
│
├─ .gitignore                 # Ignores node_modules, .env, venv, dist, etc.
└─ README.md                  # This file
```

## Prerequisites
- Node.js 18+
- npm 9+
- LiveKit Cloud project or self-hosted LiveKit server

## Quick Start

1) Backend
- Create `livekit-voice-agent/backend/.env`:
```
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
LIVEKIT_HOST=https://your-project.livekit.cloud
PORT=3001
```
- Install and run:
```
cd livekit-voice-agent/backend
npm install
npm start
```
- You should see: `Backend running on http://localhost:3001`

2) Frontend
```
cd livekit-voice-agent/frontend
npm install
npm run dev
```
Open the printed URL (default `http://localhost:3000`).

3) Connect
- In the UI, set your LiveKit Server URL (e.g., `wss://your-project.livekit.cloud`).
- Click Connect. You should see logs in browser DevTools and hear audio from the agent participant once published.

## How it Works
- Frontend requests a token from the backend: `POST /api/get-token { roomName, participantName }`
- Backend creates a signed JWT using `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`
- Frontend uses the token and your `livekitUrl` to join the room and publish microphone audio

## Ending Sessions / Rooms
- Disconnect button leaves your local session.
- The backend exposes `POST /api/admin/end-room { roomName }` to forcibly end a room (requires `LIVEKIT_HOST`).
- Each new Connect uses a fresh, random room name so sessions are isolated.

## Troubleshooting
- "token is empty": ensure backend awaits `AccessToken.toJwt()` and that `.env` is loaded.
- No audio: click once after connect to satisfy autoplay policies; check system output device; confirm remote participant publishes audio.
- CORS: backend uses `cors()`; frontend uses Vite proxy for `/api` to `http://localhost:3001`.

## Useful Commands
- Backend: `npm start` (port 3001)
- Frontend: `npm run dev` (port 3000)

## Security Notes
- Never expose your API secret to the frontend. Tokens must be generated server-side.
- Configure token TTL and minimal grants as needed.


