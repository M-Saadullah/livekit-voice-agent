const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// Room service client for administrative actions
const livekitHost = process.env.LIVEKIT_HOST; // e.g. https://your-project.livekit.cloud
let roomService;
if (livekitHost && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET) {
  roomService = new RoomServiceClient(
    livekitHost,
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET
  );
}

app.post('/api/get-token', async (req, res) => {
  const { roomName, participantName } = req.body || {};

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: 'LIVEKIT_API_KEY/SECRET not set in environment' });
  }

  if (!roomName || !participantName) {
    return res.status(400).json({ error: 'roomName and participantName are required' });
  }

  try {
    console.log(`[token] generating token`, { roomName, participantName });
    const token = new AccessToken(apiKey, apiSecret, { identity: participantName });
    token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    const jwt = await token.toJwt();
    console.log(`[token] generated jwt`, { length: typeof jwt === 'string' ? jwt.length : 0 });
    res.json({ token: jwt });
  } catch (err) {
    console.error('[token] generation failed', { message: err?.message });
    res.status(500).json({ error: 'failed to generate token' });
  }
});

// End a room (admin)
app.post('/api/admin/end-room', async (req, res) => {
  const { roomName } = req.body || {};
  if (!roomName) {
    return res.status(400).json({ error: 'roomName is required' });
  }
  if (!roomService) {
    return res.status(500).json({ error: 'RoomService not configured; set LIVEKIT_HOST/API KEY/SECRET' });
  }
  try {
    console.log('[admin] ending room', { roomName });
    await roomService.endRoom(roomName);
    res.json({ ok: true });
  } catch (e) {
    console.error('[admin] end room failed', { message: e?.message });
    res.status(500).json({ error: e?.message || 'failed to end room' });
  }
});



const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});

