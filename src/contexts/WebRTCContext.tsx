import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import socketService from '../services/socketService';
import { useRoom } from './RoomContext';

// Add debounce utility function
function debounce<F extends (...args: any[]) => any>(func: F, wait: number): (...args: Parameters<F>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function(...args: Parameters<F>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Minimal configuration with only free STUN servers
const STUN_SERVER = 'stun:stun.l.google.com:19302';
const ICE_SERVERS = [
  // Only Google's free STUN servers (no TURN relays)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

// WebRTC Configuration Constants
const ICE_RECOVERY_CONFIG = {
  INITIAL_RETRY_DELAY: 1000,
  MAX_RETRY_DELAY: 10000,
  MAX_RETRY_ATTEMPTS: 5,
  CONNECTION_TIMEOUT: 30000,
  DISCONNECTED_TIMEOUT: 15000,
  FAILED_TIMEOUT: 8000
};

// Add initialization state tracking
interface InitializationState {
  isStartingStream: boolean;
  isInitializingWebRTC: boolean;
  streamStartAttempts: number;
  webrtcInitAttempts: number;
  lastError: string | null;
}

interface PeerConnectionDetail {
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
}

interface PeerInfo {
  socketId: string;
  persistentPlayerId: string;
  playerName: string;
  isGameMaster: boolean;
}

export const peerNameRegistry = new Map<string, string>();

interface WebRTCError {
  code: string;
  message: string;
  timestamp: number;
  peerId?: string;
}

interface ConnectionState {
  iceState: RTCIceConnectionState;
  signalingState: RTCSignalingState;
  connectionState: RTCPeerConnectionState;
  lastStateChange: number;
  errors: WebRTCError[];
}

interface ExtendedRTCPeerConnection extends RTCPeerConnection {
  pendingCandidates?: RTCIceCandidateInit[];
  retryCount?: number;
  lastRetryTime?: number;
  retryTimeout?: NodeJS.Timeout;
}

interface WebRTCContextState {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  peerConnections: Map<string, RTCPeerConnection>;
  isWebcamActive: boolean;
  isMicrophoneActive: boolean;
  toggleWebcam: () => void;
  toggleMicrophone: () => void;
  startLocalStream: () => Promise<MediaStream>;
  stopLocalStream: () => void;
  initializeWebRTC: () => Promise<void>; // Changed to return Promise
  closeAllPeerConnections: () => void;
  peerNames: Map<string, string>;
  broadcastWebcamState: (enabled: boolean) => void;
  broadcastMicrophoneState: (enabled: boolean) => void;
  remotePeerStates: Map<string, {webcamEnabled: boolean, micEnabled: boolean}>;
  availableCameras: MediaDeviceInfo[];
  selectedCameraId: string | null;
  refreshDeviceList: () => Promise<void>;
  selectCamera: (deviceId: string) => Promise<void>;
  availableMicrophones: MediaDeviceInfo[];
  selectedMicrophoneId: string | null;
  selectMicrophone: (deviceId: string) => Promise<void>;
  connectionStates: Map<string, ConnectionState>;
  errors: WebRTCError[];
  clearErrors: () => void;
  getConnectionStats: (peerId: string) => Promise<RTCStatsReport | null>;
  initializationState: InitializationState; // Add this
  startWebRTCSession: () => Promise<void>; 
  startWebcamWithRetry: () => Promise<void>;
  checkMediaCapabilities: () => Promise<{
    hasMediaDevices: boolean;
    hasCamera: boolean;
    hasMicrophone: boolean;
    permissions: { camera: string; microphone: string };
    errorMessage?: string;
  }>;
}

const WebRTCContext = createContext<WebRTCContextState | undefined>(undefined);

export const useWebRTC = (): WebRTCContextState => {
  const context = useContext(WebRTCContext);
  if (!context) {
    throw new Error('useWebRTC must be used within a WebRTCProvider');
  }
  return context;
};

interface WebRTCProviderProps {
  children: ReactNode;
}

export const WebRTCProvider: React.FC<WebRTCProviderProps> = ({ children }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [peerConnections, setPeerConnections] = useState<Map<string, RTCPeerConnection>>(new Map());
  const [isWebcamActive, setIsWebcamActive] = useState<boolean>(false);
  const [isMicrophoneActive, setIsMicrophoneActive] = useState<boolean>(false);
  const [peerNames, setPeerNames] = useState<Map<string, string>>(new Map());
  const [remotePeerStates, setRemotePeerStates] = useState<Map<string, {webcamEnabled: boolean, micEnabled: boolean}>>(new Map());
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [availableMicrophones, setAvailableMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState<string | null>(null);
  const [connectionStates, setConnectionStates] = useState<Map<string, ConnectionState>>(new Map());
  const [errors, setErrors] = useState<WebRTCError[]>([]);
  
  // Add initialization state
  const [initializationState, setInitializationState] = useState<InitializationState>({
    isStartingStream: false,
    isInitializingWebRTC: false,
    streamStartAttempts: 0,
    webrtcInitAttempts: 0,
    lastError: null
  });

  // Add ref to track if WebRTC is initialized
  const isWebRTCInitialized = useRef(false);

  const { roomCode, persistentPlayerId, players, isGameMaster: currentUserIsGM } = useRoom();

  // ... (keep all the existing utility functions like closePeerConnection, handleError, etc.)

  const closePeerConnection = useCallback((peerSocketId: string) => {
    setPeerConnections(prev => {
      const pc = prev.get(peerSocketId);
      if (pc) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.oniceconnectionstatechange = null;
        pc.onsignalingstatechange = null;
        if (pc.signalingState !== 'closed') {
            pc.close();
        }
        console.log(`[WebRTC] Closed peer connection to ${peerSocketId}`);
        const newMap = new Map(prev);
        newMap.delete(peerSocketId);
        return newMap;
      }
      return prev;
    });
    setRemoteStreams(prev => {
      const newMap = new Map(prev);
      if (newMap.has(peerSocketId)) {
        newMap.delete(peerSocketId);
        console.log(`[WebRTC] Removed remote stream for ${peerSocketId}`);
      }
      return newMap;
    });
  }, []);

  const handleError = useCallback((error: WebRTCError) => {
    console.error(`[WebRTC] Error: ${error.message}`, error);
    setErrors(prev => [...prev, error]);
    
    if (errors.length > 100) {
      setErrors(prev => prev.slice(-100));
    }
  }, [errors]);

  const updateConnectionState = useCallback((peerId: string, state: Partial<ConnectionState>) => {
    setConnectionStates(prev => {
      const currentState = prev.get(peerId) || {
        iceState: 'new',
        signalingState: 'stable',
        connectionState: 'new',
        lastStateChange: Date.now(),
        errors: []
      };
      
      const newState = {
        ...currentState,
        ...state,
        lastStateChange: Date.now()
      };
      
      return new Map(prev).set(peerId, newState);
    });
  }, []);

  const getConnectionStats = useCallback(async (peerId: string): Promise<RTCStatsReport | null> => {
    const pc = peerConnections.get(peerId);
    if (!pc) return null;
    
    try {
      return await pc.getStats();
    } catch (error) {
      handleError({
        code: 'STATS_ERROR',
        message: `Failed to get connection stats for peer ${peerId}: ${error}`,
        timestamp: Date.now(),
        peerId
      });
      return null;
    }
  }, [peerConnections, handleError]);

  // Modify the createPeerConnection function to handle glare better
  const createPeerConnection = useCallback((peerSocketId: string, selfSocketId: string): RTCPeerConnection => {
    console.log(`[WebRTC] createPeerConnection called for peer: ${peerSocketId}`);
    
    const existingPc = peerConnections.get(peerSocketId);
    if (existingPc) {
      console.log(`[WebRTC] Existing PC found for ${peerSocketId}, state: ${existingPc.signalingState}. Closing it first.`);
      closePeerConnection(peerSocketId);
    }

    console.log(`[WebRTC] Creating new RTCPeerConnection for ${peerSocketId}`);
    const newPc = new RTCPeerConnection({ 
      iceServers: ICE_SERVERS,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 10
    }) as ExtendedRTCPeerConnection;

    console.log(`[WebRTC] ICE servers configured for ${peerSocketId}:`, ICE_SERVERS.length, 'STUN servers (minimal config)');

    newPc.retryCount = 0;
    newPc.lastRetryTime = Date.now();
    newPc.pendingCandidates = [];

    // Add connection state monitoring
    let connectionTimeout: NodeJS.Timeout;
    let isConnectionEstablished = false;

    // Add ICE candidate handling with filtering
    newPc.onicecandidate = (event) => {
      if (event.candidate && selfSocketId) {
        // Filter out problematic candidates that might cause connection issues
        const candidate = event.candidate;
        
        // Skip IPv6 candidates that might cause issues in some network configurations
        if (candidate.address && candidate.address.includes(':') && candidate.address.includes('[')) {
          console.log(`[WebRTC] Skipping IPv6 candidate for ${peerSocketId}:`, candidate.type, candidate.protocol);
          return;
        }
        
        // Skip TCP candidates on unusual ports that might be blocked
        if (candidate.protocol === 'tcp' && candidate.port && (candidate.port < 1024 || candidate.port > 65535)) {
          console.log(`[WebRTC] Skipping TCP candidate with unusual port for ${peerSocketId}:`, candidate.port);
          return;
        }
        
        console.log(`[WebRTC] New ICE candidate for ${peerSocketId}:`, candidate.type, candidate.protocol, candidate.address || 'no-address');
        
        // Log important candidate types
        if (candidate.type === 'srflx') {
          console.log(`[WebRTC] 🌐 STUN server-reflexive candidate for ${peerSocketId} - NAT traversal attempt`);
        }
        
        if (newPc.remoteDescription && newPc.remoteDescription.type) {
          socketService.sendWebRTCICECandidate(event.candidate, peerSocketId, selfSocketId);
        } else {
          console.log(`[WebRTC] Storing ICE candidate for ${peerSocketId} until remote description is set`);
          (newPc as ExtendedRTCPeerConnection).pendingCandidates?.push(event.candidate);
        }
      }
    };

    newPc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote track event from ${peerSocketId}:`, event.track.kind, event.track.readyState);
      
      if (!event.streams || !event.streams[0]) {
        handleError({
          code: 'TRACK_ERROR',
          message: `Received track event without streams from ${peerSocketId}`,
          timestamp: Date.now(),
          peerId: peerSocketId
        });
        return;
      }

      const remoteStream = event.streams[0];
      console.log(`[WebRTC] Remote stream for ${peerSocketId}:`, remoteStream.id, `tracks: ${remoteStream.getTracks().length}`);
      
      // Log detailed track information
      remoteStream.getTracks().forEach(track => {
        console.log(`[WebRTC] Remote track (${peerSocketId}): id=${track.id}, kind=${track.kind}, enabled=${track.enabled}, readyState=${track.readyState}`);
        
        track.onended = () => {
          console.log(`[WebRTC] Track ${track.id} ended from peer ${peerSocketId}`);
        };
        
        track.onmute = () => {
          console.log(`[WebRTC] Track ${track.id} muted from peer ${peerSocketId}`);
        };
        
        track.onunmute = () => {
          console.log(`[WebRTC] Track ${track.id} unmuted from peer ${peerSocketId}`);
        };
      });
      
      // Ensure we're not adding duplicate streams
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        console.log(`[WebRTC] Adding/updating remote stream for ${peerSocketId}`);
        newMap.set(peerSocketId, remoteStream);
        return newMap;
      });
    };

    // Enhanced ICE connection state handling
    newPc.oniceconnectionstatechange = () => {
      const state = newPc.iceConnectionState;
      console.log(`[WebRTC] ICE connection state change for ${peerSocketId}: ${state}`);
      
      updateConnectionState(peerSocketId, { iceState: state });
      
      switch (state) {
        case 'connected':
        case 'completed':
          console.log(`[WebRTC] ICE connection established with ${peerSocketId}`);
          isConnectionEstablished = true;
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
          }
          break;
          
        case 'disconnected':
          console.warn(`[WebRTC] ICE connection disconnected from ${peerSocketId}. Attempting to reconnect...`);
          // Give more time for reconnection with TURN servers
          setTimeout(() => {
            if (newPc.iceConnectionState === 'disconnected') {
              console.log(`[WebRTC] ICE still disconnected after timeout, attempting restart for ${peerSocketId}`);
              try {
                newPc.restartIce();
              } catch (e) {
                console.error(`[WebRTC] Failed to restart ICE for ${peerSocketId}:`, e);
                // Don't close immediately, TURN servers might still help
              }
            }
          }, 8000); // Increased timeout for TURN server negotiation
          break;
          
        case 'failed':
          console.error(`[WebRTC] ICE connection failed for ${peerSocketId}. Closing connection.`);
          closePeerConnection(peerSocketId);
          break;
          
        case 'closed':
          console.log(`[WebRTC] ICE connection closed for ${peerSocketId}`);
          break;
      }
    };

    // Set connection timeout - increased timeout
    connectionTimeout = setTimeout(() => {
      if (!isConnectionEstablished) {
        console.error(`[WebRTC] Connection to ${peerSocketId} timed out after ${ICE_RECOVERY_CONFIG.CONNECTION_TIMEOUT}ms`);
        // Don't immediately close, try ICE restart first
        try {
          console.log(`[WebRTC] Attempting ICE restart for timed out connection to ${peerSocketId}`);
          newPc.restartIce();
          
          // Give ICE restart some time, then close if still not connected
          setTimeout(() => {
            if (!isConnectionEstablished && newPc.iceConnectionState !== 'connected' && newPc.iceConnectionState !== 'completed') {
              console.log(`[WebRTC] ICE restart failed for ${peerSocketId}, closing connection`);
              closePeerConnection(peerSocketId);
            }
          }, 10000);
        } catch (e) {
          console.error(`[WebRTC] Failed to restart ICE on timeout for ${peerSocketId}:`, e);
          closePeerConnection(peerSocketId);
        }
      }
    }, ICE_RECOVERY_CONFIG.CONNECTION_TIMEOUT);

    newPc.onsignalingstatechange = () => {
        const state = newPc.signalingState;
        console.log(`[WebRTC] Signaling state change for ${peerSocketId}: ${state}`);
        
        updateConnectionState(peerSocketId, { signalingState: state });
        
        if (newPc.remoteDescription && newPc.remoteDescription.type) {
            const pendingCandidates = (newPc as ExtendedRTCPeerConnection).pendingCandidates || [];
            if (pendingCandidates.length > 0) {
                console.log(`[WebRTC] Sending ${pendingCandidates.length} pending ICE candidates for ${peerSocketId}`);
                pendingCandidates.forEach(candidate => {
                    if (candidate) {
                        const iceCandidate = new RTCIceCandidate(candidate);
                        socketService.sendWebRTCICECandidate(iceCandidate, peerSocketId, selfSocketId);
                    }
                });
                (newPc as ExtendedRTCPeerConnection).pendingCandidates = [];
            }
        }
    };
    
    newPc.onconnectionstatechange = () => {
        const state = newPc.connectionState;
        console.log(`[WebRTC] Connection state change for ${peerSocketId}: ${state}`);
        
        updateConnectionState(peerSocketId, { connectionState: state });
        
        switch (state) {
            case 'connected':
                console.log(`[WebRTC] Peer connection established with ${peerSocketId}`);
                isConnectionEstablished = true;
                if (connectionTimeout) {
                    clearTimeout(connectionTimeout);
                }
                break;
                
            case 'connecting':
                console.log(`[WebRTC] Peer connection connecting to ${peerSocketId}`);
                break;
                
            case 'failed':
                console.warn(`[WebRTC] Peer connection to ${peerSocketId} failed. Attempting recovery...`);
                if (newPc.signalingState !== 'closed') {
                    try {
                        console.log(`[WebRTC] Attempting ICE restart for failed connection to ${peerSocketId}`);
                        newPc.restartIce();
                    } catch (e) {
                        console.error(`[WebRTC] Failed to restart connection:`, e);
                        closePeerConnection(peerSocketId);
                    }
                }
                break;
                
            case 'disconnected':
                console.warn(`[WebRTC] Peer connection disconnected from ${peerSocketId}`);
                // Don't immediately close, it might reconnect
                break;
                
            case 'closed':
                console.log(`[WebRTC] Peer connection to ${peerSocketId} closed.`);
                closePeerConnection(peerSocketId);
                break;
        }
    };

    // Add local tracks if available
    if (localStream) {
      console.log(`[WebRTC] Adding local tracks to peer connection for ${peerSocketId}`);
      localStream.getTracks().forEach(track => {
        if (!newPc.getSenders().find(sender => sender.track === track)) {
          console.log(`[WebRTC] Adding local track to PC for ${peerSocketId}: kind=${track.kind}, id=${track.id}, enabled=${track.enabled}`);
          try {
            newPc.addTrack(track, localStream);
          } catch (e) {
            console.error(`[WebRTC] Error adding track ${track.id} to ${peerSocketId}:`, e);
          }
        } else {
          console.log(`[WebRTC] Track ${track.id} already added to ${peerSocketId}`);
        }
      });
    } else {
      console.warn('[WebRTC] Local stream not available when creating peer connection for', peerSocketId);
    }

    setPeerConnections(prev => new Map(prev).set(peerSocketId, newPc));
    return newPc;
  }, [localStream, peerConnections, closePeerConnection, players, updateConnectionState, handleError]);

  const closeAllPeerConnections = useCallback(() => {
    console.log('[WebRTC] Closing all peer connections.');
    const peerIds = Array.from(peerConnections.keys());
    peerIds.forEach(peerSocketId => {
      closePeerConnection(peerSocketId);
    });
  }, [peerConnections, closePeerConnection]);

  const broadcastWebcamState = useCallback((enabled: boolean) => {
    const currentSocket = socketService.getSocket();
    if (currentSocket && roomCode) {
      currentSocket.emit('webcam-state-change', {
        roomCode,
        enabled,
        fromSocketId: currentSocket.id
      });
    }
  }, [roomCode]);

  const broadcastMicrophoneState = useCallback((enabled: boolean) => {
    const currentSocket = socketService.getSocket();
    if (currentSocket && roomCode) {
      currentSocket.emit('microphone-state-change', {
        roomCode,
        enabled,
        fromSocketId: currentSocket.id
      });
    }
  }, [roomCode]);

  const refreshDeviceList = useCallback(async (): Promise<void> => {
    try {
      if (!(refreshDeviceList as any).hasLoggedDevices) {
        console.log('[WebRTC] Refreshing device list...');
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const cameras = devices.filter(device => device.kind === 'videoinput');
      const microphones = devices.filter(device => device.kind === 'audioinput');
      
      const cameraCountChanged = cameras.length !== availableCameras.length;
      const micCountChanged = microphones.length !== availableMicrophones.length;
      
      if (cameraCountChanged || micCountChanged) {
        if (!(refreshDeviceList as any).hasLoggedDevices || cameraCountChanged || micCountChanged) {
          console.log('[WebRTC] Found camera devices:', cameras.length);
          console.log('[WebRTC] Found microphone devices:', microphones.length);
          (refreshDeviceList as any).hasLoggedDevices = true;
        }
      }
      
      setAvailableCameras(cameras);
      setAvailableMicrophones(microphones);
      
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack && !selectedCameraId && cameras.length > 0) {
          const settings = videoTrack.getSettings();
          if (settings.deviceId) {
            setSelectedCameraId(settings.deviceId);
          }
        }
        
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack && !selectedMicrophoneId && microphones.length > 0) {
          const settings = audioTrack.getSettings();
          if (settings.deviceId) {
            setSelectedMicrophoneId(settings.deviceId);
          }
        }
      }
    } catch (error) {
      console.error('[WebRTC] Error refreshing device list:', error);
    }
  }, [localStream, availableCameras.length, availableMicrophones.length, selectedCameraId, selectedMicrophoneId]);

  // Keep selectCamera and selectMicrophone as is...
  const selectCamera = useCallback(async (deviceId: string) => {
    if (!deviceId) return;
    
    console.log(`[WebRTC] Selecting camera with deviceId: ${deviceId}`);
    setSelectedCameraId(deviceId);
    
    if (localStream) {
      try {
        localStream.getTracks().forEach(track => {
          console.log(`[WebRTC] Stopping track: ${track.kind} (${track.id})`);
          track.stop();
        });
        
        console.log('[WebRTC] Requesting new stream with selected camera');
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 480, max: 640 },
            height: { ideal: 360, max: 480 },
            frameRate: { ideal: 24, max: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000,
            sampleSize: 16,
            channelCount: 1
          }
        });
        
        console.log('[WebRTC] New stream acquired with selected camera:', newStream);
        
        setLocalStream(newStream);
        setIsWebcamActive(true);
        
        peerConnections.forEach((pc, peerSocketId) => {
          try {
            const videoSenders = pc.getSenders().filter(sender => 
              sender.track && sender.track.kind === 'video'
            );
            
            const videoTrack = newStream.getVideoTracks()[0];
            if (videoTrack && videoSenders.length > 0) {
              console.log(`[WebRTC] Replacing video track for peer ${peerSocketId}`);
              videoSenders[0].replaceTrack(videoTrack);
            } else if (videoTrack) {
              console.log(`[WebRTC] Adding new video track for peer ${peerSocketId}`);
              pc.addTrack(videoTrack, newStream);
            }
            
            const audioTracks = newStream.getAudioTracks();
            if (audioTracks.length > 0) {
              const audioSenders = pc.getSenders().filter(sender => 
                sender.track && sender.track.kind === 'audio'
              );
              
              if (audioSenders.length === 0) {
                audioTracks.forEach(track => {
                  pc.addTrack(track, newStream);
                });
              } else if (audioSenders.length > 0 && audioTracks.length > 0) {
                console.log(`[WebRTC] Replacing audio track for peer ${peerSocketId}`);
                audioSenders[0].replaceTrack(audioTracks[0]);
              }
            }
          } catch (error) {
            console.error(`[WebRTC] Error updating tracks for peer ${peerSocketId}:`, error);
          }
        });
        
        broadcastWebcamState(true);
      } catch (error) {
        console.error('[WebRTC] Error switching camera:', error);
        setIsWebcamActive(false);
        broadcastWebcamState(false);
      }
    } else {
      console.log('[WebRTC] Camera selected, but no stream exists yet. It will be used when starting the stream.');
    }
  }, [localStream, peerConnections, broadcastWebcamState]);

  const selectMicrophone = useCallback(async (deviceId: string) => {
    if (!deviceId) return;
    
    console.log(`[WebRTC] Selecting microphone with deviceId: ${deviceId}`);
    setSelectedMicrophoneId(deviceId);
    
    if (localStream) {
      try {
        const audioTracks = localStream.getAudioTracks();
        audioTracks.forEach(track => {
          console.log(`[WebRTC] Stopping audio track: ${track.id}`);
          track.stop();
        });
        
        console.log('[WebRTC] Requesting new audio stream with selected microphone');
        const newAudioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000,
            sampleSize: 16,
            channelCount: 1
          }
        });
        
        console.log('[WebRTC] New audio stream acquired with selected microphone:', newAudioStream);
        
        const newAudioTrack = newAudioStream.getAudioTracks()[0];
        
        const newStream = new MediaStream();
        
        localStream.getVideoTracks().forEach(track => {
          newStream.addTrack(track);
        });
        
        if (newAudioTrack) {
          newStream.addTrack(newAudioTrack);
        }
        
        setLocalStream(newStream);
        setIsMicrophoneActive(true);
        
        peerConnections.forEach((pc, peerSocketId) => {
          try {
            const audioSenders = pc.getSenders().filter(sender => 
              sender.track && sender.track.kind === 'audio'
            );
            
            if (newAudioTrack && audioSenders.length > 0) {
              console.log(`[WebRTC] Replacing audio track for peer ${peerSocketId}`);
              audioSenders[0].replaceTrack(newAudioTrack);
            } else if (newAudioTrack) {
              console.log(`[WebRTC] Adding new audio track for peer ${peerSocketId}`);
              pc.addTrack(newAudioTrack, newStream);
            }
          } catch (error) {
            console.error(`[WebRTC] Error updating audio track for peer ${peerSocketId}:`, error);
          }
        });
        
        broadcastMicrophoneState(true);
      } catch (error) {
        console.error('[WebRTC] Error switching microphone:', error);
        setIsMicrophoneActive(false);
        broadcastMicrophoneState(false);
      }
    } else {
      console.log('[WebRTC] Microphone selected, but no stream exists yet. It will be used when starting the stream.');
    }
  }, [localStream, peerConnections, broadcastMicrophoneState]);

  // Enhanced startLocalStream with multiple fallback strategies
  const startLocalStream = useCallback(async (): Promise<MediaStream> => {
    if (initializationState.isStartingStream) {
      console.log('[WebRTC] Stream start already in progress');
      throw new Error('Stream start already in progress');
    }

    try {
      setInitializationState(prev => ({ ...prev, isStartingStream: true, lastError: null }));
      console.log('[WebRTC] Starting local media stream...');
      
      // Stop any existing stream first
      if (localStream) {
        console.log('[WebRTC] Stopping existing stream');
        localStream.getTracks().forEach(track => track.stop());
      }
      
      // Refresh device list
      await refreshDeviceList();
      
      // Strategy 1: Try with selected devices and high quality
      try {
        console.log('[WebRTC] Attempting high-quality stream with selected devices...');
        const constraints: MediaStreamConstraints = {
          video: selectedCameraId ? { 
            deviceId: { exact: selectedCameraId },
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 30, max: 30 }
          } : {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 30, max: 30 }
          },
          audio: selectedMicrophoneId ? { 
            deviceId: { exact: selectedMicrophoneId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } : {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('[WebRTC] High-quality stream acquired successfully');
        return await finalizeStream(stream);
      } catch (error: unknown) {
        console.warn('[WebRTC] High-quality stream failed, trying fallback strategies...', error);
      }

      // Strategy 2: Try with basic video constraints (no device selection)
      try {
        console.log('[WebRTC] Attempting basic video stream...');
        const constraints: MediaStreamConstraints = {
          video: {
            width: { ideal: 320, max: 640 },
            height: { ideal: 240, max: 480 },
            frameRate: { ideal: 15, max: 24 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('[WebRTC] Basic video stream acquired successfully');
        return await finalizeStream(stream);
      } catch (error: unknown) {
        console.warn('[WebRTC] Basic video stream failed, trying minimal constraints...', error);
      }

      // Strategy 3: Try with minimal video constraints
      try {
        console.log('[WebRTC] Attempting minimal video stream...');
        const constraints: MediaStreamConstraints = {
          video: true,
          audio: true
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('[WebRTC] Minimal video stream acquired successfully');
        return await finalizeStream(stream);
      } catch (error: unknown) {
        console.warn('[WebRTC] Minimal video stream failed, trying audio-only...', error);
      }

      // Strategy 4: Audio-only fallback
      try {
        console.log('[WebRTC] Attempting audio-only stream...');
        const constraints: MediaStreamConstraints = {
          video: false,
          audio: selectedMicrophoneId ? { 
            deviceId: { exact: selectedMicrophoneId },
            echoCancellation: true,
            noiseSuppression: true
          } : {
            echoCancellation: true,
            noiseSuppression: true
          }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('[WebRTC] Audio-only stream acquired successfully');
        return await finalizeStream(stream);
      } catch (error: unknown) {
        console.warn('[WebRTC] Audio-only stream failed, trying basic audio...', error);
      }

      // Strategy 5: Basic audio-only
      try {
        console.log('[WebRTC] Attempting basic audio stream...');
        const constraints: MediaStreamConstraints = {
          video: false,
          audio: true
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('[WebRTC] Basic audio stream acquired successfully');
        return await finalizeStream(stream);
      } catch (error: unknown) {
        console.error('[WebRTC] All media access strategies failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown media access error';
        throw new Error(`Camera and microphone access failed: ${errorMessage}`);
      }

    } catch (error) {
      console.error('[WebRTC] Error starting local stream:', error);
      setLocalStream(null);
      setIsWebcamActive(false);
      setIsMicrophoneActive(false);
      
      setInitializationState(prev => ({ 
        ...prev, 
        lastError: error instanceof Error ? error.message : 'Failed to start stream'
      }));
      
      throw error;
    } finally {
      setInitializationState(prev => ({ ...prev, isStartingStream: false }));
    }

    // Helper function to finalize and validate the stream
    async function finalizeStream(stream: MediaStream): Promise<MediaStream> {
      // Validate stream
      if (!stream || stream.getTracks().length === 0) {
        throw new Error('Invalid stream received from getUserMedia');
      }
      
      // Ensure all tracks are enabled
      stream.getTracks().forEach(track => {
        track.enabled = true;
        console.log(`[WebRTC] ${track.kind} track enabled: id=${track.id}, enabled=${track.enabled}, readyState=${track.readyState}`);
      });
      
      // Set stream state
      setLocalStream(stream);
      
      // Set activity states
      const hasVideoTrack = stream.getVideoTracks().length > 0;
      const hasAudioTrack = stream.getAudioTracks().length > 0;
      
      setIsWebcamActive(hasVideoTrack);
      setIsMicrophoneActive(hasAudioTrack);
      
      console.log('[WebRTC] Local stream started successfully:', {
        streamId: stream.id,
        videoTracks: hasVideoTrack,
        audioTracks: hasAudioTrack
      });
      
      return stream;
    }
  }, [selectedCameraId, selectedMicrophoneId, refreshDeviceList, initializationState.isStartingStream, localStream]);

  const stopLocalStream = useCallback(() => {
    console.log('[WebRTC] Stopping local stream');
    if (localStream) {
      localStream.getTracks().forEach(track => {
        console.log(`[WebRTC] Stopping track: ${track.kind} (${track.id})`);
        track.stop();
      });
    }
    
    closeAllPeerConnections();
    setLocalStream(null);
    setIsWebcamActive(false);
    setIsMicrophoneActive(false);
    isWebRTCInitialized.current = false;
    
    console.log('[WebRTC] Local stream stopped, all peer connections closed.');
  }, [localStream, closeAllPeerConnections]);

  const toggleWebcam = useCallback(() => {
    if (!localStream) {
      console.warn('[WebRTC] Cannot toggle webcam: no local stream');
      return;
    }
    
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length === 0) {
      console.warn('[WebRTC] Cannot toggle webcam: no video tracks');
      return;
    }
    
    const currentState = videoTracks[0].enabled;
    const newState = !currentState;
    
    videoTracks.forEach(track => {
      track.enabled = newState;
    });
    
    setIsWebcamActive(newState);
    broadcastWebcamState(newState);
    
    console.log(`[WebRTC] Webcam toggled: ${newState}`);
  }, [localStream, broadcastWebcamState]);

  const toggleMicrophone = useCallback(() => {
    if (!localStream) {
      console.warn('[WebRTC] Cannot toggle microphone: no local stream');
      return;
    }
    
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.warn('[WebRTC] Cannot toggle microphone: no audio tracks');
      return;
    }
    
    const currentState = audioTracks[0].enabled;
    const newState = !currentState;
    
    audioTracks.forEach(track => {
      track.enabled = newState;
    });
    
    setIsMicrophoneActive(newState);
    broadcastMicrophoneState(newState);
    
    console.log(`[WebRTC] Microphone toggled: ${newState}`);
  }, [localStream, broadcastMicrophoneState]);

  // Simplified initializeWebRTC
  const initializeWebRTC = useCallback(async (): Promise<void> => {
    // Prevent duplicate initialization
    if (initializationState.isInitializingWebRTC || isWebRTCInitialized.current) {
      console.log('[WebRTC] Already initializing or initialized, skipping');
      return;
    }

    // Check prerequisites
    if (!roomCode) {
      const error = 'Missing roomCode for WebRTC initialization';
      console.error('[WebRTC]', error);
      throw new Error(error);
    }

    setInitializationState(prev => ({
      ...prev,
      isInitializingWebRTC: true,
      webrtcInitAttempts: prev.webrtcInitAttempts + 1,
      lastError: null
    }));

    try {
      console.log('[WebRTC] Initializing WebRTC...', {
        roomCode,
        isGameMaster: currentUserIsGM,
        attempt: initializationState.webrtcInitAttempts + 1
      });
      
      // Ensure socket connection
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        throw new Error('Socket not connected');
      }
      
      // Send WebRTC ready signal
      await socketService.sendWebRTCReady(roomCode);
      
      // Mark as initialized
      isWebRTCInitialized.current = true;
      
      setInitializationState(prev => ({
        ...prev,
        isInitializingWebRTC: false,
        lastError: null
      }));
      
      console.log('[WebRTC] WebRTC initialized successfully');
    } catch (error) {
      console.error('[WebRTC] Error initializing WebRTC:', error);
      
      setInitializationState(prev => ({
        ...prev,
        isInitializingWebRTC: false,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      }));
      
      throw error;
    }
  }, [roomCode, currentUserIsGM, initializationState]);

  // Simplified combined session starter
  const startWebRTCSession = useCallback(async (): Promise<void> => {
    console.log('[WebRTC] Starting complete WebRTC session...');
    
    try {
      // Step 1: Start local stream and get the actual stream object
      console.log('[WebRTC] Step 1: Starting local stream...');
      const stream = await startLocalStream();
      
      // Step 2: Wait for stream to be fully ready
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Step 3: Initialize WebRTC
      console.log('[WebRTC] Step 2: Initializing WebRTC...');
      await initializeWebRTC();
      
      console.log('[WebRTC] WebRTC session started successfully');
    } catch (error) {
      console.error('[WebRTC] Failed to start WebRTC session:', error);
      throw error;
    }
  }, [startLocalStream, initializeWebRTC]);

  // Simplified retry logic
  const startWebcamWithRetry = useCallback(async (): Promise<void> => {
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[WebRTC] Webcam start attempt ${attempt}/${maxRetries}`);
        
        // Validate prerequisites
        if (!roomCode) {
          throw new Error('Room code is required');
        }
        
        // Start the session
        await startWebRTCSession();
        
        console.log(`[WebRTC] Webcam started successfully on attempt ${attempt}`);
        return; // Success!
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`[WebRTC] Attempt ${attempt} failed:`, lastError.message);
        
        if (attempt < maxRetries) {
          console.log(`[WebRTC] Retrying in 2 seconds... (${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    // All attempts failed
    console.error('[WebRTC] All retry attempts failed');
    throw lastError || new Error('Failed to start webcam after all retries');
  }, [roomCode, startWebRTCSession]);

  useEffect(() => {
    const currentSocket = socketService.getSocket();
    const selfSocketId = currentSocket?.id;

    if (!currentSocket || !roomCode || !selfSocketId) {
      return; 
    }

    const handleNewPeer = async ({ newPeer }: { newPeer: PeerInfo }) => {
      if (newPeer.isGameMaster || peerConnections.size < 3) {
        console.log(`[WebRTC] New peer joined: ${newPeer.socketId} (${newPeer.playerName}), ${newPeer.isGameMaster ? 'GM' : 'Player'}`);
      }
      
      peerNameRegistry.set(newPeer.socketId, newPeer.playerName);
      setPeerNames(prev => new Map(prev).set(newPeer.socketId, newPeer.playerName));
      
      try {
        const pc = createPeerConnection(newPeer.socketId, selfSocketId);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await pc.setLocalDescription(offer);
        socketService.sendWebRTCOffer(offer, newPeer.socketId, selfSocketId);
      } catch (error) {
        console.error('[WebRTC] Error creating offer for new peer:', error);
      }
    };

    const handleExistingPeers = ({ peers }: { peers: PeerInfo[] }) => {
      if (peers.length < 5) {
        console.log(`[WebRTC] Processing ${peers.length} existing peers.`);
      }
      
      const newPeerNames = new Map<string, string>();
      peers.forEach(peer => {
        if (peer.socketId && peer.playerName) {
          peerNameRegistry.set(peer.socketId, peer.playerName);
          newPeerNames.set(peer.socketId, peer.playerName);
          
          if (peer.isGameMaster || peers.length < 3) {
            console.log(`[WebRTC] Existing peer: ${peer.socketId} -> ${peer.playerName}`);
          }
        }
      });
      
      setPeerNames(prev => {
        const updated = new Map(prev);
        newPeerNames.forEach((name, id) => {
          updated.set(id, name);
        });
        return updated;
      });
      
      peers.forEach(async peer => {
        if (peer.socketId === selfSocketId) return;
        
        const existingPc = peerConnections.get(peer.socketId);
        if (existingPc && existingPc.signalingState !== 'closed' && 
            (existingPc.iceConnectionState === 'connected' || 
             existingPc.iceConnectionState === 'completed')) {
          if (peer.isGameMaster) {
            console.log(`[WebRTC] Already have a good connection to ${peer.socketId}. Skipping offer.`);
          }
          return;
        }
        
        if (peer.isGameMaster || peers.length < 3) {
          console.log(`[WebRTC] Creating connection with EXISTING PEER ${peer.socketId} (${peer.playerName})`);
        }
        
        try {
          const pc = createPeerConnection(peer.socketId, selfSocketId);
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          await pc.setLocalDescription(offer);
          socketService.sendWebRTCOffer(offer, peer.socketId, selfSocketId);
        } catch (error) {
          console.error(`[WebRTC] Error creating offer for existing peer ${peer.socketId}:`, error);
        }
      });
    };

    const handleOffer = async ({ offer, from }: { offer: RTCSessionDescriptionInit, from: string }) => {
      console.log(`[WebRTC] Received offer from ${from} (I am ${selfSocketId}).`);
      if (from === selfSocketId) return;

      let pc = peerConnections.get(from);
      if (pc && (pc.signalingState !== 'stable' && pc.signalingState !== 'closed')) {
        console.warn(`[WebRTC] Received offer from ${from}, but PC is in state ${pc.signalingState}. Potential glare. Recreating PC.`);
        pc = createPeerConnection(from, selfSocketId);
      } else if (!pc || pc.signalingState === 'closed') {
        console.log(`[WebRTC] No existing open PC for offer from ${from}, creating one.`);
        pc = createPeerConnection(from, selfSocketId); 
      }
      
      try {
        console.log(`[WebRTC] Setting remote offer from ${from}. Current signalingState: ${pc.signalingState}`);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        console.log(`[WebRTC] Remote offer set. New signalingState: ${pc.signalingState}. Creating answer for ${from}.`);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log(`[WebRTC] Local answer created and set. New signalingState: ${pc.signalingState}. Sending answer to ${from}.`);
        socketService.sendWebRTCAnswer(answer, from, selfSocketId);
      } catch (error) {
        console.error(`[WebRTC] Error handling offer from ${from} and creating answer:`, error);
      }
    };

    const handleAnswer = async ({ answer, from }: { answer: RTCSessionDescriptionInit, from: string }) => {
      console.log(`[WebRTC] Received answer from ${from}.`);
      const pc = peerConnections.get(from);
      if (pc) {
        if (pc.signalingState === 'have-local-offer' || pc.signalingState === 'have-remote-pranswer') {
          try {
            console.log(`[WebRTC] Setting remote answer from ${from}. Current signalingState: ${pc.signalingState}`);
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            console.log(`[WebRTC] Remote answer set. New signalingState: ${pc.signalingState}`);
          } catch (error) {
            console.error(`[WebRTC] Error setting remote description from answer from ${from}:`, error);
          }
        } else {
          console.warn(`[WebRTC] Received answer from ${from}, but PC signalingState is ${pc.signalingState}. Ignoring answer.`);
        }
      } else {
        console.warn(`[WebRTC] Received answer from ${from}, but no peer connection found.`);
      }
    };

    const handleIceCandidate = ({ candidate, from }: { candidate: RTCIceCandidateInit, from: string }) => {
      const pc = peerConnections.get(from) as ExtendedRTCPeerConnection | undefined;
      if (pc) {
        if (pc.remoteDescription) { 
          pc.addIceCandidate(new RTCIceCandidate(candidate))
            .then(() => {
              console.log(`[WebRTC] Successfully added ICE candidate from ${from}`);
            })
            .catch(e => {
              console.error(`[WebRTC] Error adding ICE candidate from ${from}:`, e);
            });
        } else {
          console.log(`[WebRTC] Received ICE candidate from ${from}, but remote description not set. Storing as pending.`);
          if (!pc.pendingCandidates) {
            pc.pendingCandidates = [];
          }
          pc.pendingCandidates.push(candidate);
          console.log(`[WebRTC] Stored pending ICE candidate from ${from}. Total pending: ${pc.pendingCandidates.length}`);
        }
      } else {
        console.warn(`[WebRTC] Received ICE candidate from ${from}, but no peer connection found`);
      }
    };

    const handleUserLeft = ({ socketId: peerSocketId }: { socketId: string }) => {
      console.log(`[WebRTC] Peer ${peerSocketId} left`);
      closePeerConnection(peerSocketId);
      
      setPeerNames(prev => {
        const updated = new Map(prev);
        updated.delete(peerSocketId);
        return updated;
      });
      peerNameRegistry.delete(peerSocketId);
    };
    
    const handleWebcamStateChange = ({ fromSocketId, enabled }: { fromSocketId: string, enabled: boolean }) => {
      if (fromSocketId === selfSocketId) return;

      setRemotePeerStates(prev => {
        const newMap = new Map(prev);
        const currentState = newMap.get(fromSocketId) || { webcamEnabled: true, micEnabled: true };
        newMap.set(fromSocketId, { ...currentState, webcamEnabled: enabled });
        return newMap;
      });
    };

    const handleMicrophoneStateChange = ({ fromSocketId, enabled }: { fromSocketId: string, enabled: boolean }) => {
      if (fromSocketId === selfSocketId) return;

      setRemotePeerStates(prev => {
        const newMap = new Map(prev);
        const currentState = newMap.get(fromSocketId) || { webcamEnabled: true, micEnabled: true };
        newMap.set(fromSocketId, { ...currentState, micEnabled: enabled });
        return newMap;
      });
    };

    currentSocket.on('webrtc-new-peer', handleNewPeer);
    currentSocket.on('webrtc-existing-peers', handleExistingPeers);
    currentSocket.on('webrtc-offer', handleOffer);
    currentSocket.on('webrtc-answer', handleAnswer);
    currentSocket.on('webrtc-ice-candidate', handleIceCandidate);
    currentSocket.on('webrtc-user-left', handleUserLeft);
    currentSocket.on('webcam-state-change', handleWebcamStateChange);
    currentSocket.on('microphone-state-change', handleMicrophoneStateChange);
    
    currentSocket.on('webrtc-refresh-states', () => {
      if (localStream) {
        const videoEnabled = localStream.getVideoTracks().some(track => track.enabled);
        const audioEnabled = localStream.getAudioTracks().some(track => track.enabled);
        broadcastWebcamState(videoEnabled);
        broadcastMicrophoneState(audioEnabled);
      }
    });

    return () => {
      console.log('[WebRTC] Cleaning up WebRTC listeners');
      currentSocket.off('webrtc-new-peer', handleNewPeer);
      currentSocket.off('webrtc-existing-peers', handleExistingPeers);
      currentSocket.off('webrtc-offer', handleOffer);
      currentSocket.off('webrtc-answer', handleAnswer);
      currentSocket.off('webrtc-ice-candidate', handleIceCandidate);
      currentSocket.off('webrtc-user-left', handleUserLeft);
      currentSocket.off('webcam-state-change', handleWebcamStateChange);
      currentSocket.off('microphone-state-change', handleMicrophoneStateChange);
      currentSocket.off('webrtc-refresh-states');
    };
  }, [roomCode, localStream, createPeerConnection, closePeerConnection, peerConnections, currentUserIsGM, broadcastWebcamState, broadcastMicrophoneState]);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Add utility function to check media capabilities
  const checkMediaCapabilities = useCallback(async (): Promise<{
    hasMediaDevices: boolean;
    hasCamera: boolean;
    hasMicrophone: boolean;
    permissions: { camera: string; microphone: string };
    errorMessage?: string;
  }> => {
    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return {
          hasMediaDevices: false,
          hasCamera: false,
          hasMicrophone: false,
          permissions: { camera: 'unknown', microphone: 'unknown' },
          errorMessage: 'Browser does not support media devices'
        };
      }

      // Check for available devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(device => device.kind === 'videoinput');
      const hasMicrophone = devices.some(device => device.kind === 'audioinput');

      // Check permissions
      let cameraPermission = 'unknown';
      let microphonePermission = 'unknown';

      try {
        if ('permissions' in navigator) {
          const cameraResult = await navigator.permissions.query({ name: 'camera' as PermissionName });
          cameraPermission = cameraResult.state;
          
          const micResult = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          microphonePermission = micResult.state;
        }
      } catch (error) {
        console.log('[WebRTC] Permission API not available or failed:', error);
      }

      return {
        hasMediaDevices: true,
        hasCamera,
        hasMicrophone,
        permissions: { camera: cameraPermission, microphone: microphonePermission }
      };
    } catch (error) {
      return {
        hasMediaDevices: false,
        hasCamera: false,
        hasMicrophone: false,
        permissions: { camera: 'unknown', microphone: 'unknown' },
        errorMessage: error instanceof Error ? error.message : 'Unknown error checking capabilities'
      };
    }
  }, []);

  const value = {
    localStream,
    remoteStreams,
    peerConnections,
    isWebcamActive,
    isMicrophoneActive,
    toggleWebcam,
    toggleMicrophone,
    startLocalStream,
    stopLocalStream,
    initializeWebRTC,
    closeAllPeerConnections,
    peerNames,
    broadcastWebcamState,
    broadcastMicrophoneState,
    remotePeerStates,
    availableCameras,
    selectedCameraId,
    refreshDeviceList,
    selectCamera,
    availableMicrophones,
    selectedMicrophoneId,
    selectMicrophone,
    connectionStates,
    errors,
    clearErrors,
    getConnectionStats,
    initializationState,
    startWebRTCSession,
    startWebcamWithRetry,
    checkMediaCapabilities,
  };

  return <WebRTCContext.Provider value={value}>{children}</WebRTCContext.Provider>;
};