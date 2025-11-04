import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from 'lucide-react';

export default function LiveKitVoiceAgent() {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [error, setError] = useState('');
  
  // Configuration - Update these with your LiveKit credentials
  const [config, setConfig] = useState({
    livekitUrl: 'wss://teamsagent-gvv23059.livekit.cloud',
    token: '' // Will be generated from your backend
  });

  const roomRef = useRef(null);
  const localTrackRef = useRef(null);

  const generateToken = async () => {
    // In production, call your backend to generate a token
    // For now, you'll need to replace this with your actual token generation
    try {
      const response = await fetch('/api/get-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: 'voice-agent',
          participantName: 'user-' + Math.random().toString(36).substr(2, 9)
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to get token');
      }
      
      const data = await response.json();
      return data.token;
    } catch (err) {
      console.error('Token generation error:', err);
      // For development, you can manually paste a token here
      throw new Error('Please implement token generation endpoint');
    }
  };

  const connectToAgent = async () => {
    try {
      setError('');
      setConnectionStatus('connecting');

      // Import LiveKit SDK dynamically
      const LiveKit = await import('https://cdn.jsdelivr.net/npm/livekit-client@2.0.0/+esm');
      
      // Generate or get token
      let token;
      try {
        token = await generateToken();
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
        console.log('Connected to room');
      });

      room.on('disconnected', () => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        console.log('Disconnected from room');
      });

      room.on('trackSubscribed', (track, publication, participant) => {
        if (track.kind === 'audio') {
          const audioElement = track.attach();
          document.body.appendChild(audioElement);
          console.log('Agent audio track subscribed');
        }
      });

      room.on('trackUnsubscribed', (track) => {
        track.detach().forEach(element => element.remove());
      });

      room.on('participantConnected', (participant) => {
        console.log('Participant connected:', participant.identity);
      });

      // Connect to room
      await room.connect(config.livekitUrl, token);

      // Publish local audio track
      await room.localParticipant.enableMicrophone();
      localTrackRef.current = room.localParticipant.audioTrackPublications.values().next().value;

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
    }
  };

  const toggleMute = async () => {
    if (roomRef.current && localTrackRef.current) {
      const newMutedState = !isMuted;
      await roomRef.current.localParticipant.setMicrophoneEnabled(!newMutedState);
      setIsMuted(newMutedState);
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
                Note: You need to implement a backend endpoint to generate LiveKit tokens.
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
              <li>Implement a backend endpoint at <code className="bg-black/30 px-1 rounded">/api/get-token</code></li>
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