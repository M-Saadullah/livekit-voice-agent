import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, Sparkles } from 'lucide-react';

export default function LiveKitVoiceAgent() {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [error, setError] = useState('');
  const [roomName, setRoomName] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  
  const [config, setConfig] = useState({
    livekitUrl: 'wss://teamsagent-gvv23059.livekit.cloud',
    token: ''
  });
  

  const roomRef = useRef(null);
  const localTrackRef = useRef(null);
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);

  const generateToken = async (room) => {
    try {
      console.log('[frontend] requesting token...');
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/get-token`, {
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

  const setupAudioAnalyser = (audioElement) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContextRef.current.createMediaElementSource(audioElement);
      source.connect(analyser);
      analyser.connect(audioContextRef.current.destination);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateLevel = () => {
        if (analyserRef.current && isConnected) {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255);
          requestAnimationFrame(updateLevel);
        }
      };
      updateLevel();
    } catch (err) {
      console.warn('[frontend] audio analyser setup failed', err?.message);
    }
  };

  const connectToAgent = async () => {
    try {
      setError('');
      setConnectionStatus('connecting');
      console.log('[frontend] connecting to LiveKit...');

      const newRoom = `voice-agent-${Math.random().toString(36).slice(2, 8)}`;
      setRoomName(newRoom);

      const LiveKit = await import('livekit-client');
      
      let token;
      try {
        token = await generateToken(newRoom);
        console.log('[frontend] got token, length:', token ? token.length : 0);
      } catch (err) {
        setError('Token generation failed. Please configure your backend endpoint.');
        setConnectionStatus('disconnected');
        return;
      }

      const room = new LiveKit.Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: LiveKit.VideoPresets.h720.resolution,
        },
      });

      roomRef.current = room;

      room.on('connected', () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        console.log('[frontend] connected to room');
      });

      room.on('disconnected', () => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        setHasVideo(false);
        console.log('[frontend] disconnected from room');
      });

      room.on('reconnecting', () => console.log('[frontend] reconnecting...'));
      room.on('reconnected', () => console.log('[frontend] reconnected'));

      room.on('trackSubscribed', async (track, publication, participant) => {
        console.log('[frontend] track subscribed', track.kind, 'from', participant.identity);
        
        if (track.kind === 'audio') {
          const audioElement = track.attach();
          audioElement.autoplay = true;
          audioElement.muted = false;
          audioElement.volume = 1.0;
          audioElement.setAttribute('playsinline', 'true');
          
          // Hide the audio element
          audioElement.style.display = 'none';
          document.body.appendChild(audioElement);
          
          if (typeof audioElement.setSinkId === 'function') {
            try {
              await audioElement.setSinkId('default');
              console.log('[frontend] audio sink set to default');
            } catch (e) {
              console.warn('[frontend] setSinkId failed', e?.message);
            }
          }
          
          // Setup audio analyser for visualization
          setupAudioAnalyser(audioElement);
          
          const tryPlay = async () => {
            try {
              await audioElement.play();
              console.log('[frontend] audio element playing');
            } catch (err) {
              console.warn('[frontend] autoplay blocked; waiting for user gesture', err?.message);
            }
          };
          void tryPlay();
        }
        
        if (track.kind === 'video') {
          console.log('[frontend] video track received');
          const videoElement = track.attach();
          videoElement.autoplay = true;
          videoElement.playsInline = true;
          videoElement.muted = true;
          videoElement.style.width = '100%';
          videoElement.style.height = '100%';
          videoElement.style.objectFit = 'cover';
          
          if (videoRef.current) {
            videoRef.current.innerHTML = '';
            videoRef.current.appendChild(videoElement);
            console.log('[frontend] video attached to DOM, setting hasVideo to true');
            setHasVideo(true);
            
            // Force play in case autoplay doesn't work
            setTimeout(async () => {
              try {
                await videoElement.play();
                console.log('[frontend] video playing, hasVideo state:', true);
              } catch (err) {
                console.warn('[frontend] video play failed', err?.message);
              }
            }, 100);
          } else {
            console.error('[frontend] videoRef.current is null!');
          }
        }
      });

      room.on('trackUnsubscribed', (track) => {
        if (track.kind === 'video') {
          setHasVideo(false);
        }
        track.detach().forEach(element => element.remove());
        console.log('[frontend] track unsubscribed', track.kind);
      });

      room.on('participantConnected', (participant) => {
        console.log('[frontend] participant connected', participant.identity);
      });

      console.log('[frontend] calling room.connect...');
      await room.connect(config.livekitUrl, token);
      console.log('[frontend] room.connect resolved');

      const resumeAllAudio = async () => {
        const audios = document.querySelectorAll('audio');
        for (const el of audios) {
          try {
            await el.play();
          } catch {}
        }
      };
      void resumeAllAudio();

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
      setHasVideo(false);
      setAudioLevel(0);
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;
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
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-cyan-950 to-emerald-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="max-w-5xl w-full relative z-10">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Video Display Section */}
          <div className="order-1 lg:order-1">
            <div className="bg-black/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden h-full min-h-[500px] relative">
              {/* Video container - always present */}
              <div ref={videoRef} className="w-full h-full min-h-[500px] bg-black flex items-center justify-center absolute inset-0" style={{display: hasVideo ? 'flex' : 'none'}}>
                {/* Video will be attached here */}
              </div>
              
              {/* Placeholder - show when no video */}
              {!hasVideo && (
                <div className="text-center p-8 flex items-center justify-center h-full min-h-[500px]">
                  {isConnected ? (
                    <>
                      <div className="text-center">
                        <div className="relative inline-block mb-4">
                          <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                            <Video className="w-16 h-16 text-white" />
                          </div>
                          {audioLevel > 0.1 && (
                            <div 
                              className="absolute inset-0 rounded-full border-4 border-purple-400 animate-ping"
                              style={{
                                animationDuration: '1s',
                                opacity: audioLevel
                              }}
                            ></div>
                          )}
                        </div>
                        <p className="text-white/70 text-lg">Waiting for video stream...</p>
                        <div className="mt-4 flex justify-center gap-1">
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-center">
                        <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/10">
                          <VideoOff className="w-16 h-16 text-white/30" />
                        </div>
                        <p className="text-white/50 text-lg">Connect to start video</p>
                      </div>
                    </>
                  )}
                </div>
              )}
              
              {/* Audio Level Indicator */}
              {isConnected && audioLevel > 0.05 && (
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="bg-black/60 backdrop-blur-sm rounded-full p-2">
                    <div className="h-2 bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full transition-all duration-100"
                         style={{width: `${Math.min(audioLevel * 100, 100)}%`}}>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Control Panel Section */}
          <div className="order-2 lg:order-2">
            <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20 h-full">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 mb-3">
                  <Sparkles className="w-8 h-8 text-cyan-300" />
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                    LiveKit Voice Agent
                  </h1>
                </div>
                <p className="text-cyan-200">Live voice & video interaction</p>
              </div>

              {/* Status Indicator */}
              <div className="mb-8 text-center">
                <div className="inline-flex items-center gap-3 bg-black/30 rounded-full px-6 py-3 border border-white/10 shadow-lg">
                  <div className={`w-3 h-3 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50' :
                    connectionStatus === 'connecting' ? 'bg-cyan-400 animate-pulse shadow-lg shadow-cyan-400/50' :
                    'bg-gray-400'
                  }`} />
                  <span className="text-white text-sm font-semibold capitalize">
                    {connectionStatus}
                  </span>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl backdrop-blur-sm">
                  <p className="text-red-200 text-sm font-medium">{error}</p>
                  <p className="text-red-300 text-xs mt-2">
                    Make sure your backend is running on port 3001.
                  </p>
                </div>
              )}

              {/* Connection Setup */}
              {!isConnected && (
                <div className="mb-6 space-y-4">
                  <div>
                    <label className="block text-cyan-200 text-sm font-semibold mb-2">
                      LiveKit Server URL
                    </label>
                    <input
                      type="text"
                      value={config.livekitUrl}
                      onChange={(e) => setConfig({...config, livekitUrl: e.target.value})}
                      placeholder="wss://your-project.livekit.cloud"
                      className="w-full px-4 py-3 bg-black/30 border border-white/20 rounded-xl text-white placeholder-cyan-300/50 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all"
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
                    className="w-full bg-gradient-to-r from-cyan-500 via-emerald-500 to-cyan-500 text-white py-4 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-emerald-500/40 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:scale-105 active:scale-95"
                  >
                    <Phone className="w-6 h-6" />
                    {connectionStatus === 'connecting' ? 'Connecting...' : 'Start Session'}
                  </button>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={toggleMute}
                        className={`py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                          isMuted
                            ? 'bg-red-500/30 text-red-200 border-2 border-red-400 shadow-lg shadow-red-500/30'
                            : 'bg-white/10 text-white border-2 border-white/30 hover:bg-white/20 shadow-lg hover:shadow-cyan-500/20'
                        }`}
                      >
                        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        {isMuted ? 'Unmute' : 'Mute'}
                      </button>

                      <button
                        onClick={disconnectFromAgent}
                        className="bg-red-500/30 text-red-200 py-4 rounded-xl font-bold hover:bg-red-500/40 transition-all flex items-center justify-center gap-2 border-2 border-red-400 shadow-lg shadow-red-500/30 hover:scale-105 active:scale-95"
                      >
                        <PhoneOff className="w-5 h-5" />
                        End
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Instructions */}
              <div className="mt-8 p-4 bg-black/30 rounded-xl border border-white/10">
                <h3 className="text-white font-bold mb-3 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-300" />
                  Quick Setup
                </h3>
                <ol className="text-cyan-200 text-xs space-y-2 list-decimal list-inside">
                  <li>Verify your LiveKit server URL</li>
                  <li>Ensure backend is running (port 3001)</li>
                  <li>Click "Start Session" to connect</li>
                  <li>Grant microphone permissions</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-cyan-300/70 text-sm flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4" />
            Powered by LiveKit
          </p>
        </div>
      </div>
    </div>
  );
}