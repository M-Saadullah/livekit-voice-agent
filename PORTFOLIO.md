# LiveKit Voice Agent

**Real-time voice communication app with AI agent integration**

A full-stack web application enabling real-time voice conversations between users and AI agents via LiveKit's WebRTC infrastructure.

## Tech Stack
- **Frontend**: React, Vite, TailwindCSS, LiveKit Client SDK
- **Backend**: Node.js, Express, LiveKit Server SDK
- **Infrastructure**: LiveKit Cloud (WebRTC)

## Key Features
- Secure token-based authentication with server-side JWT generation
- Real-time bidirectional audio streaming
- Dynamic room creation with isolated sessions
- Admin endpoints for room management
- Comprehensive logging and error handling
- Modern, responsive UI with connection status indicators

## Architecture
- **Token Service**: Express backend generates secure access tokens using LiveKit API credentials
- **Client App**: React frontend connects to LiveKit rooms, handles audio capture/playback, and manages connection state
- **Session Management**: Each user session creates a unique room; automatic cleanup on disconnect

## Highlights
- Server-side token generation for enhanced security
- WebRTC-based low-latency audio communication
- Monorepo structure with separate backend/frontend modules
- Production-ready error handling and logging

