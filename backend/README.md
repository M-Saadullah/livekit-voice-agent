# Backend (Node/Express)

Simple token server that generates LiveKit access tokens and exposes an admin endpoint to end rooms.

## Setup
1) Create `.env`:
```
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
LIVEKIT_HOST=https://your-project.livekit.cloud
PORT=3001
```

2) Install and run:
```
npm install
npm start
```

## Endpoints
- POST `/api/get-token`
  - Body: `{ "roomName": "voice-agent-xxxxx", "participantName": "user-xxxxx" }`
  - Response: `{ "token": "<jwt>" }`

- POST `/api/admin/end-room`
  - Body: `{ "roomName": "voice-agent-xxxxx" }`
  - Response: `{ "ok": true }`
  - Requires `LIVEKIT_HOST`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`

## Logs
- Request logs via morgan.
- Token generation logs: room, identity, JWT length.

## Notes
- Do not expose API secret to the frontend. Keep token generation server-side.
- Consider adding TTL to tokens and least-privilege grants.


