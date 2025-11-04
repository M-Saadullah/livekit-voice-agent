import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from 'lucide-react';

export default function LiveKitVoiceAgent() {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [error, setError] = useState('');
  const [roomName, setRoomName] = useState('');
  
  // Configuration - Update these with your LiveKit credentials
  const [config, setConfig] = useState({
    livekitUrl: 'wss://teamsagent-gvv23059.livekit.cloud',
    token: '' // Will be generated from your backend
  });

  const roomRef = useRef(null);
  const localTrackRef = useRef(null);

  const generateToken = async (room) => {
    // Call your backend to generate a token (proxy configured in vite.config.js)
    try {
      console.log('[frontend] requesting token...');
      const response = await fetch('/api/get-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: room,
          participantName: 'user-' + Math.random().toString(36).substr(2, 9)
        })
      });
      
      if (!response.ok) {
        console.error('[frontend] token request failed', response.status, response.statusText);
        throw new Error('Failed to get token');
      }
      
      const data = await response.json();
      console.log('[frontend] token received', { length: typeof data?.token === 'string' ? data.token.length : 0 });
      return data.token;
    } catch (err) {
      console.error('Token generation error:', err);
      throw new Error('Please ensure your backend is running on port 3001');
    }
  };

  const connectToAgent = async () => {
    try {
      setError('');
      setConnectionStatus('connecting');
      console.log('[frontend] connecting to LiveKit...');

      // Generate a fresh room for this session
      const newRoom = `voice-agent-${Math.random().toString(36).slice(2, 8)}`;
      setRoomName(newRoom);

      // Import LiveKit SDK dynamically
      const LiveKit = await import('livekit-client');
      
      // Generate or get token (pass the freshly generated room name directly)
      let token;
      try {
        token = await generateToken(newRoom);
        console.log('[frontend] got token, length:', token ? token.length : 0);
      } catch (err) {
        setError('Token generation failed. Please configure your backend endpoint.');
        setConnectionStatus('disconnected');
        return;
      }

      // Create room instance
      const room = new LiveKit.Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: LiveKit.VideoPresets.h720.resolution,
        },
      });

      roomRef.current = room;

      // Set up event listeners
      room.on('connected', () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        console.log('[frontend] connected to room');
      });

      room.on('disconnected', () => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        console.log('[frontend] disconnected from room');
      });

      room.on('reconnecting', () => console.log('[frontend] reconnecting...'));
      room.on('reconnected', () => console.log('[frontend] reconnected'));
      room.on('connectionStateChanged', (state) => console.log('[frontend] connectionStateChanged', state));

      room.on('trackSubscribed', async (track, publication, participant) => {
        if (track.kind === 'audio') {
          const audioElement = track.attach();
          // Improve autoplay reliability across browsers
          audioElement.autoplay = true;
          audioElement.muted = false;
          audioElement.volume = 1.0;
          audioElement.controls = true;
          audioElement.setAttribute('playsinline', 'true');
          document.body.appendChild(audioElement);
          if (typeof audioElement.setSinkId === 'function') {
            try {
              // use system default; replace with a specific deviceId if desired
              await audioElement.setSinkId('default');
              console.log('[frontend] audio sink set to default');
            } catch (e) {
              console.warn('[frontend] setSinkId failed', e?.message);
            }
          }
          audioElement.addEventListener('error', (e) => {
            console.warn('[frontend] audio element error', audioElement?.error);
          });
          const tryPlay = async () => {
            try {
              await audioElement.play();
              console.log('[frontend] audio element playing');
            } catch (err) {
              console.warn('[frontend] autoplay blocked; waiting for user gesture', err?.message);
            }
          };
          void tryPlay();
          console.log('[frontend] audio track subscribed from', participant.identity);
        }
      });

      room.on('trackUnsubscribed', (track) => {
        track.detach().forEach(element => element.remove());
        console.log('[frontend] track unsubscribed', track.kind);
      });

      room.on('participantConnected', (participant) => console.log('[frontend] participant connected', participant.identity));
      room.on('participantDisconnected', (participant) => console.log('[frontend] participant disconnected', participant.identity));
      room.on('trackPublished', (pub, participant) => console.log('[frontend] track published', pub.kind, 'by', participant.identity));
      room.on('trackMuted', (pub, participant) => console.log('[frontend] track muted', pub.kind, 'by', participant.identity));
      room.on('trackUnmuted', (pub, participant) => console.log('[frontend] track unmuted', pub.kind, 'by', participant.identity));
      room.on('activeSpeakersChanged', (speakers) => console.log('[frontend] active speakers', speakers.map(s => s.identity)));

      // Connect to room
      console.log('[frontend] calling room.connect...');
      await room.connect(config.livekitUrl, token);
      console.log('[frontend] room.connect resolved');
      // Attempt to resume any pending audio playback after connect (some browsers require gesture)
      const resumeAllAudio = async () => {
        const audios = document.querySelectorAll('audio');
        for (const el of audios) {
          try {
            // eslint-disable-next-line no-await-in-loop
            await el.play();
          } catch {}
        }
      };
      void resumeAllAudio();

      // Publish local audio track (LiveKit v2 API)
      await room.localParticipant.setMicrophoneEnabled(true);
      localTrackRef.current = true;
      console.log('[frontend] microphone enabled');

    } catch (err) {
      console.error('Connection error:', err);
      setError(`Connection failed: ${err.message}`);
      setConnectionStatus('disconnected');
    }
  };

  const disconnectFromAgent = async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
      localTrackRef.current = null;
      setIsConnected(false);
      setConnectionStatus('disconnected');
      // End the room on the server so a new session gets a new room next time
    //   if (roomName) {
    //     try {
    //       await fetch('/api/admin/end-room', {
    //         method: 'POST',
    //         headers: { 'Content-Type': 'application/json' },
    //         body: JSON.stringify({ roomName })
    //       });
    //       console.log('[frontend] requested room end', roomName);
    //     } catch (e) {
    //       console.warn('[frontend] failed to end room', e?.message);
    //     }
    //   }
    //   setRoomName('');
    }
  };

  const toggleMute = async () => {
    if (roomRef.current) {
      const newMutedState = !isMuted;
      console.log('[frontend] toggleMute ->', newMutedState ? 'mute' : 'unmute');
      await roomRef.current.localParticipant.setMicrophoneEnabled(!newMutedState);
      setIsMuted(newMutedState);
      console.log('[frontend] microphone', newMutedState ? 'muted' : 'unmuted');
    }
  };

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/20">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Voice Agent</h1>
            <p className="text-purple-200">Connect and interact with your AI assistant</p>
          </div>

          {/* Status Indicator */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 bg-white/5 rounded-full px-4 py-2 border border-white/10">
              <div className={`w-3 h-3 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-400 animate-pulse' :
                connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
                'bg-gray-400'
              }`} />
              <span className="text-white text-sm font-medium capitalize">
                {connectionStatus}
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-200 text-sm">{error}</p>
              <p className="text-red-300 text-xs mt-2">
                Note: Make sure your backend is running on port 3001.
              </p>
            </div>
          )}

          {/* Connection Setup */}
          {!isConnected && (
            <div className="mb-6 space-y-4">
              <div>
                <label className="block text-purple-200 text-sm font-medium mb-2">
                  LiveKit Server URL
                </label>
                <input
                  type="text"
                  value={config.livekitUrl}
                  onChange={(e) => setConfig({...config, livekitUrl: e.target.value})}
                  placeholder="wss://your-project.livekit.cloud"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-400"
                />
              </div>
            </div>
          )}

          {/* Control Buttons */}
          <div className="space-y-4">
            {!isConnected ? (
              <button
                onClick={connectToAgent}
                disabled={connectionStatus === 'connecting'}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                <Phone className="w-5 h-5" />
                {connectionStatus === 'connecting' ? 'Connecting...' : 'Connect to Agent'}
              </button>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={toggleMute}
                    className={`py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                      isMuted
                        ? 'bg-red-500/20 text-red-300 border-2 border-red-500/50'
                        : 'bg-white/10 text-white border-2 border-white/20 hover:bg-white/20'
                    }`}
                  >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    {isMuted ? 'Unmute' : 'Mute'}
                  </button>

                  <button
                    onClick={disconnectFromAgent}
                    className="bg-red-500/20 text-red-300 py-4 rounded-xl font-semibold hover:bg-red-500/30 transition-all flex items-center justify-center gap-2 border-2 border-red-500/50"
                  >
                    <PhoneOff className="w-5 h-5" />
                    Disconnect
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-8 p-4 bg-white/5 rounded-lg border border-white/10">
            <h3 className="text-white font-semibold mb-2 text-sm">Setup Instructions:</h3>
            <ol className="text-purple-200 text-xs space-y-1 list-decimal list-inside">
              <li>Update the LiveKit server URL with your project URL</li>
              <li>Make sure your backend is running on port 3001</li>
              <li>The endpoint should generate a LiveKit token with your API credentials</li>
              <li>Click "Connect to Agent" to start the voice session</li>
            </ol>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-4 text-center">
          <p className="text-purple-300 text-sm">
            Powered by LiveKit
          </p>
        </div>
      </div>
    </div>
  );
}
